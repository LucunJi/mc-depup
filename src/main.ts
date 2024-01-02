import { promises as fs } from "fs"
import * as core from '@actions/core'
import { Properties } from "./properties"
import { fetchLatestVersion, parseMcVersion } from "./network"

const PROPERTIES_FILE = 'gradle.properties'
const MINECRAFT_VERSION_KEY = 'minecraft_version'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const [properties, mcVersions] =
            await Promise.all([
                fs.readFile(PROPERTIES_FILE)
                    .then(buf => Properties.fromString(buf.toString())),
                fetchLatestVersion()
            ])

        const currentMcVersion = properties.get(MINECRAFT_VERSION_KEY)
        if (currentMcVersion === undefined) {
            throw Error(`${MINECRAFT_VERSION_KEY} is not found in ${PROPERTIES_FILE}`)
        }
        const { minor, patch } = parseMcVersion(currentMcVersion)
        const latestPatch = mcVersions.get(minor)!

        core.setOutput('has_update', latestPatch > patch)
        core.debug(`Latest version is 1.${minor}.${latestPatch}, and current version is 1.${minor}.${patch}`)

        if (latestPatch > patch) {
            // TODO
        }


        // const ms: string = core.getInput('milliseconds')
        // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
        // core.debug(`Waiting ${ms} milliseconds ...`)
        // Set outputs for other workflow steps to use
        // core.setOutput('time', new Date().toTimeString())
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message)
    }
}
