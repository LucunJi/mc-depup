import * as core from '@actions/core'
import { fetchMavenMeta } from "./network/maven"
import { fetchLatestMcPatches } from "./network/minecraft"
import { GitHubVariables } from "./utils"
import { McVersion, DependencyVersion } from './version'
import { Dependency, DependencyContext, DependencySettings } from './dependency'
import { getContextualWildcardExpander } from './pattern'
import * as prop from "properties-parser"
import { setTimeout } from "timers/promises"

const PROPERTIES_FILE = 'gradle.properties'
const MINECRAFT_VERSION_KEY = 'minecraft_version'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const properties = prop.createEditor(PROPERTIES_FILE)
        const githubVars = new GitHubVariables()
        const depSettings = await DependencySettings.readFromFile(githubVars.configPath)

        const currMcVersionStr = properties.get(MINECRAFT_VERSION_KEY)
        if (currMcVersionStr === undefined)
            throw Error(`${MINECRAFT_VERSION_KEY} is not found in ${PROPERTIES_FILE}`)
        const currMcVersion = McVersion.fromString(currMcVersionStr)


        let targetMcVersion = currMcVersion
        let newerMcVersion = false
        if (githubVars.updateMcPatch) {
            const mcVersions = await fetchLatestMcPatches()
            const latestMcPatch = mcVersions.get(currMcVersion.minor)!
            targetMcVersion = new McVersion(currMcVersion.major, currMcVersion.minor, latestMcPatch)
            newerMcVersion = targetMcVersion.compare(currMcVersion) > 0
            if (newerMcVersion) {
                core.info(`${MINECRAFT_VERSION_KEY}: ${currMcVersionStr} => ${targetMcVersion.toString()}`)
                properties.set(MINECRAFT_VERSION_KEY, targetMcVersion.toString())
            } else {
                core.info(`${MINECRAFT_VERSION_KEY}: ${currMcVersionStr} => ${targetMcVersion.toString()} (no change)`)
            }
        } else {
            core.info(`Skip updating ${MINECRAFT_VERSION_KEY}`)
        }

        const needUpdateDep = !githubVars.updateOnlyWithMc || newerMcVersion
        let updatedProps = 0
        const totalProps = depSettings.dependencies
            .flatMap(dep => Array.from(dep.properties.entries())).length
        const summary: string[] = []
        if (needUpdateDep) {

            const tasks = depSettings.dependencies
                .map(async (dep: Dependency, i: number) =>
                    (async (): Promise<ReturnType<typeof fetchDependencyUpdates>> => {
                        try {
                            return await fetchDependencyUpdates(dep, targetMcVersion)
                        } catch (error) {
                            if (!githubVars.tolerable) throw error
                            core.info(`Skip error in fetching the latest version for the dependency at index ${i} due to tolerable=true`)
                            if (error instanceof Error) core.info(error.message)
                            return new Map<string, string>()
                        }
                    })()
                )

            const results = await Promise.all(tasks)

            const newPropVals = results.flatMap(newValMap => Array.from(newValMap.entries()))
            for (const [propName, newVal] of newPropVals) {
                const oldVal = properties.get(propName)

                let info = `${propName}: ${oldVal} => ${newVal}`
                if (oldVal !== newVal) {
                    properties.set(propName, newVal)
                    ++updatedProps
                } else {
                    info += ' (no change)'
                }
                summary.push(info)
                core.info(info)
            }
        }

        if (!githubVars.dryRun)
            properties.save()
        else
            core.info('dry_run is set to true, the files will not be updated')


        core.info(`${updatedProps}/${totalProps} dependencies updated`)
        githubVars.setAnyUpdate(updatedProps > 0)
        githubVars.setSummary(summary.join('\n'))
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

/**
 * @returns a map giving updated properties
 */
async function fetchDependencyUpdates(dependency: Dependency, targetMcVersion: McVersion): Promise<Map<string, string>> {

    // making trials assumes that Minecraft has a very limited number of patches per minor version
    let versions: string[] = []
    let lastArtifactId: string | undefined
    for (const omitPatch of [false, true])
        for (let mcPatch = omitPatch ? 0 : targetMcVersion.patch; mcPatch >= 0; --mcPatch) {
            if (mcPatch !== targetMcVersion.patch)
                await setTimeout(1000)

            const trialContext: DependencyContext = {
                mcVersion: new McVersion(targetMcVersion.major, targetMcVersion.minor, mcPatch),
                omitMcPatch: omitPatch
            }
            const contextualized = dependency.contextualize(trialContext)
            const artifactId = contextualized.artifactId
            if (lastArtifactId !== artifactId) {
                try {
                    const meta = await fetchMavenMeta(dependency.repository, dependency.groupId, artifactId)
                    versions = meta.versions
                } catch (error) {
                    core.debug(`Trial failed for ${dependency.groupId}:${artifactId} in ${dependency.repository} with Minecraft version ${trialContext.mcVersion.toString(trialContext.omitMcPatch)}`)

                    if (error instanceof Error) core.debug(error.message)

                    continue  // next trial
                }
                lastArtifactId = artifactId
            }


            let bestVersionStr: string | undefined
            let bestVersion: DependencyVersion | undefined
            let bestCaptures: string[] | undefined
            for (const versionStr of versions) {
                const matchResult = versionStr.match(contextualized.version)

                if (matchResult === null) continue  // ignore unmatched versions

                const captures = matchResult.slice(1)
                const parsedVersion = dependency.capturesToVersion(captures)

                if (bestVersion === undefined || parsedVersion.compare(bestVersion) >= 0) {
                    bestVersionStr = versionStr
                    bestVersion = parsedVersion
                    bestCaptures = captures
                }
            }

            if (bestVersionStr === undefined || bestCaptures === undefined)
                continue

            core.info(`The best matching version is ${bestVersionStr} for ${dependency.groupId}:${artifactId} in ${dependency.repository}`)

            // resolve properties when a trial is successful
            const newPropValues = new Map<string, string>()
            for (const [propName, propAttrs] of dependency.properties.entries()) {

                let newVal: string | undefined
                switch (propAttrs.source) {
                    case 'version':
                        newVal = bestVersionStr
                        break
                    case 'artifactId':
                        newVal = artifactId
                        break
                    case 'wildcard': {
                        const expander = getContextualWildcardExpander(propAttrs.wildcardName!)
                        if (expander !== undefined) {
                            newVal = expander(trialContext)
                        } else {
                            for (let j = 0; j < dependency.version.length; ++j) {
                                if (dependency.version[j].type === 'named_wildcard'
                                    && dependency.version[j].value === propAttrs.wildcardName) {

                                    newVal = bestCaptures[j]
                                }
                            }
                        }
                        break
                    }
                }
                newPropValues.set(propName, newVal!)
            }

            return newPropValues
        }

    throw new Error(`No matching version is found for ${dependency.groupId} in ${dependency.repository}`)
}

