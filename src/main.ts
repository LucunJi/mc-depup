import * as core from '@actions/core'
import { fetchLatestMcVersions, fetchMavenMeta } from "./network"
import { GitHubVariables, McVersion, isString } from "./utils"
import * as dependencySettings from './dependency'
import { Dependency } from './dependency'
import * as prop from "properties-parser"
import { setTimeout } from "timers/promises"

const PROPERTIES_FILE = 'gradle.properties'
const MINECRAFT_VERSION_KEY = 'minecraft_version'
const CONFIG_FILEPATH = 'modding-dependencies.yml'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const properties = prop.createEditor(PROPERTIES_FILE)
        const githubVars = new GitHubVariables()
        const depSettings = await dependencySettings.readFromFile(CONFIG_FILEPATH)

        const currMcVersionStr = properties.get(MINECRAFT_VERSION_KEY)
        if (currMcVersionStr === undefined)
            throw Error(`${MINECRAFT_VERSION_KEY} is not found in ${PROPERTIES_FILE}`)
        const currMcVersion = McVersion.fromString(currMcVersionStr)


        let targetMcVersion = currMcVersion
        let newerMcVersion = false
        if (githubVars.updateMcPatch) {
            const mcVersions = await fetchLatestMcVersions()
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
        let updatedVariables = 0
        let totalVariables = 0
        if (needUpdateDep) {

            const tasks = depSettings.dependencies
                .map((dep: Dependency, i: number) =>
                    (async (): Promise<ReturnType<typeof fetchUpdate> | undefined> => {
                        try {
                            return await fetchUpdate(dep, targetMcVersion)
                        } catch (error) {
                            if (!githubVars.tolerable) throw error
                            core.info(`Skip error in fetching the latest version for the dependency at index ${i} due to tolerable=true`)
                            if (error instanceof Error) core.info(error.message)
                            return undefined
                        }
                    })()
                )

            const results = await Promise.all(tasks)
            // TODO:
            // for (let i = 0; i < results.length; ++i) {
            //     const result = results[i]
            //     if (result === undefined)
            //         continue
            //
            //     const config = configs[i]
            //     for (const variable of config.variables) {
            //         const [name, source] = Object.entries(variable)[0]
            //         const oldVal = properties.get(name)
            //         const newVal = result[source]
            //         if (oldVal !== newVal) {
            //             properties.set(name, newVal)
            //             ++updatedVariables
            //             core.info(`${name}: ${oldVal} => ${newVal}`)
            //         } else {
            //             core.info(`${name}: ${oldVal} => ${newVal} (no change)`)
            //         }
            //         ++totalVariables
            //     }
            // }
        }

        properties.save()

        core.info(`${updatedVariables}/${totalVariables} dependencies updated`)
        githubVars.setAnyUpdate(updatedVariables > 0)
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

/**
 * @returns string of best matching version,
 *  or undefined if matching version exist
 */
async function fetchUpdate(dependency: Dependency, targetMcVersion: McVersion):
    Promise<{ artifactId: string, version: string }> {

    // making trials assumes that Minecraft has a very limited number of patches per minor version
    for (let mcPatch = targetMcVersion.patch; mcPatch >= 0; --mcPatch) {
        if (mcPatch !== targetMcVersion.patch)
            await setTimeout(1000)

        const trialMcVersion = new McVersion(targetMcVersion.major, targetMcVersion.minor, mcPatch)
        const contextualized = dependency.contextualize({ mcVersion: trialMcVersion })
        const artifactId = contextualized.artifactId
        let versions: string[]
        try {
            const meta = await fetchMavenMeta(dependency.repository, dependency.groupId, artifactId)
            versions = meta.versions
        } catch (error) {
            core.debug(`Trial failed for ${dependency.groupId}:${artifactId} in ${dependency.repository} with Minecraft version ${trialMcVersion.toString()}`)
            if (error instanceof Error) core.debug(error.message)
            continue  // next trial
        }

        let bestVersion: string | undefined
        let bestExtraction: string[] | undefined
        for (const versionStr of versions) {
            const matchResult = versionStr.match(contextualized.version)

            if (matchResult === null)
                continue  // ignore unmatched

            const extraction = matchResult.slice(1)
            if (bestExtraction === undefined
                || dependency.compareVersionCaptures(extraction, bestExtraction) >= 0) {
                bestExtraction = extraction
                bestVersion = versionStr
            }
        }

        if (bestVersion === undefined || bestExtraction === undefined)
            continue

        core.info(`The best matching version is ${bestVersion} for ${dependency.groupId}:${artifactId} in ${dependency.repository}`)
        return { artifactId: artifactId, version: bestVersion }
    }

    throw new Error(`No matching version is found for ${dependency.groupId}:${dependency.artifactId} in ${dependency.repository}`)
}

