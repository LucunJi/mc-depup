import { promises as fs } from "fs"
import * as core from '@actions/core'
import { fetchLatestMcVersions, fetchMavenMeta } from "./network.js"
import { GitHubVariables, McVersion, isString } from "./utils.js"
import * as prop from "properties-parser"
import * as yml from "yaml"
import escapeStringRegexp from "escape-string-regexp"

const PROPERTIES_FILE = 'gradle.properties'
const MINECRAFT_VERSION_KEY = 'minecraft_version'
const CONFIG_FILENAME = 'modding-dependencies.yml'
const CONFIG_PATH = `.github/${CONFIG_FILENAME}`

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const properties = prop.createEditor(PROPERTIES_FILE)

        const currMcVersionStr = properties.get(MINECRAFT_VERSION_KEY)
        if (currMcVersionStr === undefined)
            throw Error(`${MINECRAFT_VERSION_KEY} is not found in ${PROPERTIES_FILE}`)
        const currMcVersion = McVersion.fromString(currMcVersionStr)

        const githubVars = new GitHubVariables()

        let targetMcVersion = currMcVersion
        if (githubVars.updateMcPatch) {
            const mcVersions = await fetchLatestMcVersions()
            const latestMcPatch = mcVersions.get(currMcVersion.minor)!
            targetMcVersion = new McVersion(currMcVersion.major, currMcVersion.minor, latestMcPatch)

            core.debug(`Update ${MINECRAFT_VERSION_KEY} from ${currMcVersionStr} to ${targetMcVersion.toString()}`)
            properties.set(MINECRAFT_VERSION_KEY, targetMcVersion.toString())
        } else {
            core.debug(`Skip updating ${MINECRAFT_VERSION_KEY}`)
        }

        const needUpdateDep = !githubVars.updateOnlyWithMc
            || targetMcVersion.compare(currMcVersion) > 0
        let updatedVariables = 0
        let totalVariables = 0
        if (needUpdateDep) {
            const configs = await readUpdateConfigs(properties)
            const tasks: ReturnType<typeof fetchUpdate>[] = []
            for (const config of configs) {
                const task = async () => {
                    try {
                        const version = await fetchUpdate(config, targetMcVersion)
                        if (version !== undefined) return version
                    } catch (ignored) { }
                    if (githubVars.tolerable)
                        return undefined
                    // the error that actually get logged
                    throw new Error('Fail fast in finding version')
                }
                tasks.push(task())
            }

            const results = await Promise.all(tasks)
            for (let i = 0; i < results.length; ++i) {
                const result = results[i]
                if (result === undefined) 
                    continue

                const config = configs[i]
                for (const variable of config.variables) {
                    const [name, source] = Object.entries(variable)[0]
                    const oldVal = properties.get(name)
                    const newVal = result[source]
                    if (oldVal !== newVal) {
                        properties.set(name, newVal)
                        ++updatedVariables
                        core.info(`${name}: ${oldVal} => ${newVal}`)
                    } else {
                        core.info(`${name}: no change (${oldVal})`)
                    }
                    ++totalVariables
                }
            }
        }

        properties.save()

        core.info(`${updatedVariables}/${totalVariables} dependencies updated`)
        githubVars.setAnyUpdate(updatedVariables > 0)
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

type UpdateConfigEntry = {
    repository: string,
    groupId: string,
    artifactId: string,
    version: string,
    variables: Record<string, 'version' | 'artifactId'>[],
}

/**
 * @returns string of best matching version,
 *  or undefined if matching version exist
 */
async function fetchUpdate(config: UpdateConfigEntry, targetMcVersion: McVersion):
    Promise<{ artifactId: string, version: string } | undefined> {
    // assume that Minecraft has a very limited number of patches per minor version
    for (let mcPatch = targetMcVersion.patch; mcPatch >= 0; --mcPatch) {
        const context = {
            mcVersion: new McVersion(targetMcVersion.major, targetMcVersion.minor, mcPatch)
        }
        const artifactId = parsePattern(config.artifactId, context, false, false).result
        let versions: string[]
        try {
            const meta = await fetchMavenMeta(config.repository, config.groupId, artifactId)
            versions = meta.versions
        } catch (error) {
            core.debug(`Trial failed for ${config.groupId}:${artifactId} in ${config.repository}`)
            continue
        }

        const { result: versionPattern, extractions } =
            parsePattern(config.version, { mcVersion: targetMcVersion }, true, true)
        const versionRegex = new RegExp(`^${versionPattern}$`)
        let bestVersion: string | undefined
        let bestExtraction: string[] | undefined
        for (const versionStr of versions) {
            const matchResult = versionStr.match(versionRegex)
            if (matchResult === null)
                continue
            if (matchResult.length - 1 !== extractions.length)
                throw new Error('Length of match result does not match expectation')

            const extraction = matchResult.slice(1)
            if (bestExtraction === undefined
                || compareExtraction(extraction, bestExtraction, extractions) >= 0) {
                bestExtraction = extractions
                bestVersion = versionStr
            }
        }

        if (bestVersion === undefined || bestExtraction === undefined)
            continue

        core.info(`The best matching version is ${bestVersion} for ${config.groupId}:${artifactId} in ${config.repository}`)
        return { artifactId: artifactId, version: bestVersion }
    }

    core.info(`No matching version is found for ${config.groupId}:${config.artifactId} in ${config.repository}`)
    return undefined
}

/**
 * Lengths of three arguments must match
 */
function compareExtraction(x: string[], y: string[], types: ExtractionType[]): number {
    for (let i = 0; i < x.length; ++i) {
        let cmp: number;
        switch (types[i]) {
            case '#': cmp = parseInt(x[i]) - parseInt(y[i]); break
            case '*': cmp = 0; break;
        }
        if (cmp != 0)
            return cmp
    }
    return 0
}


type ExtractionType = '#' | '*'
function parsePattern(pattern: string, context: { mcVersion: McVersion }, allowWildcard: boolean, escapeForRegex: boolean): { result: string, extractions: ExtractionType[] } {
    if (pattern.length == 0)
        return { result: '', extractions: [] }

    let constructed = ''
    let extractionType: ExtractionType[] = []
    const replacer = (varName: string) => {
        switch (varName) {
            case 'mcMajor': return context.mcVersion.major.toString()
            case 'mcMinor': return context.mcVersion.minor.toString()
            case 'mcPatch': return context.mcVersion.patch.toString()
            case 'mcVersion': return context.mcVersion.toString(false)
            case 'mcVersionFull': return context.mcVersion.toString(true)
            default: throw new Error(`Invalid variable ${varName}`)
        }
    }

    // const varFilled = pattern.replaceAll(/\${[^{}]+}/, match => replacer(match.slice(2, -1)))

    // This allows more flexibility if we want to add more patterns,
    // as all patterns are processed in one-go
    let start = 0
    let i = 0
    do {
        let replaced: string | undefined
        const end = i
        let isWildcard = false
        switch (pattern[i]) {
            case '#':
                replaced = '(\\d+)'
                extractionType.push('#')
                isWildcard = true
                ++i
                break
            case '*':
                replaced = '(.*)'
                extractionType.push('*')
                isWildcard = true
                ++i
                break
            case '$': {
                ++i
                if (i < pattern.length && pattern[i] !== '{')
                    break
                let right = i + 1
                while (right < pattern.length && pattern[right] !== '}')
                    ++right
                if (right >= pattern.length)
                    throw new Error('No right bracket is found')
                // i + 1 <= right < pattern.length
                replaced = replacer(pattern.slice(i + 1, right))
                if (escapeForRegex)
                    replaced = escapeStringRegexp(replaced)
                i = right + 1
                break
            }
            default:
                ++i
                break
        }
        if (isWildcard && !allowWildcard)
            throw new Error('Wildcard is only allowed in version')

        if (replaced !== undefined) {
            // start <= end < pattern.length
            if (end > start) {
                let part = pattern.slice(start, end)
                if (escapeForRegex)
                    part = escapeStringRegexp(part)
                constructed += escapeStringRegexp
            }
            start = i
            constructed += replaced
        }
    } while (i < pattern.length)

    if (start < pattern.length) {
        let part = pattern.slice(start)
        if (escapeForRegex)
            part = escapeStringRegexp(part)
        constructed += part
    }

    return { result: constructed, extractions: extractionType }
}

async function readUpdateConfigs(properties: prop.Editor): Promise<UpdateConfigEntry[]> {
    const configs: UpdateConfigEntry[] = []
    const configFile = await fs.readFile(CONFIG_PATH)
    const configYml = yml.parse(configFile.toString())
    if (!Array.isArray(configYml))
        throw new Error('Configuration must be an array')
    for (const entry of configYml) {
        const repository = entry['repository'] as string
        const groupId = entry['groupId'] as string
        const artifactId = entry['artifactId'] as string
        const version = entry['version'] as string
        const variables = entry['variables'] as Record<string, 'version' | 'artifactId'>[]
        if (!isString(repository))
            throw new Error('repository must be a string')
        if (!isString(groupId))
            throw new Error('groupId must be a string')
        if (!isString(artifactId))
            throw new Error('artifactId must be a string')
        if (!isString(version))
            throw new Error('version must be a string')
        if (!Array.isArray(variables))
            throw new Error('variables must be an array')
        for (const variable of variables) {
            const content = Object.entries(variable)
            if (content.length !== 1 || !isString(content[0][0])
                || content[0][1] !== 'version' && content[0][1] !== 'artifactId') {
                throw new Error('Each entry in variables must be a mapping from a name to either version or artifactId')
            }
            const variableName = content[0][0]
            if (properties.get(variableName) === undefined) {
                throw new Error(`Configured variable ${variableName} does not exist in ${PROPERTIES_FILE}`)
            }
        }

        configs.push({ repository, groupId, artifactId, version, variables })
    }

    return configs
}
