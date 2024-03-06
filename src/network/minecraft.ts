import { McVersion } from '../version'

const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

/**
 * Returns a mapping from minor versions to patch versions for Minecraft
 */
export async function fetchLatestMcPatches(): Promise<Map<number, number>> {
    const resp = await fetch(VERSION_MANIFEST_URL)
    const json = await resp.json()
    const latest = new Map<number, number>()  // minor to patch version
    for (const versionStr of json.versions!) {
        if (versionStr.type === 'release') {
            const version = McVersion.fromString(versionStr.id)

            if ((latest.get(version.minor) ?? -1) < version.patch) {
                latest.set(version.minor, version.patch)
            }
        }
    }
    return latest
}

