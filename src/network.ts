import { XMLParser } from 'fast-xml-parser'
import { McVersion, isString } from './utils.js'
import { version } from 'os'


const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

export async function fetchLatestMcVersions(): Promise<Map<number, number>> {
    const resp = await fetch(VERSION_MANIFEST_URL)
    const json = await resp.json()
    const latest = new Map<number, number>()  // minor to patch version
    for (const versionStr of json['versions']!) {
        if (versionStr.type === 'release') {
            const version = McVersion.fromString(versionStr)

            if ((latest.get(version.minor) ?? -1) < version.patch) {
                latest.set(version.minor, version.patch)
            }
        }
    }
    return latest
}

const MAVEN_META_PARSER = new XMLParser()

/**
 * Returns a list of versions from A Level Metadata
 * See https://maven.apache.org/repositories/metadata.html#the-a-level-metadata
 */
export async function fetchMavenMeta(repo: string, groupId: string, artifactId: string): Promise<{ versions: string[] }> {
    const url = new URL(`${groupId.replaceAll('.', '/')}/${artifactId}/maven-metadata.xml`, repo)
    const resp = await fetch(url)
    if (!resp.ok)
        throw new Error(`Not 2xx status code: ${resp.status}`)
    const text = await resp.text()
    const xml = MAVEN_META_PARSER.parse(text)
    const versions = xml.metadata?.versioning?.versions?.version
    if (!Array.isArray(versions))
        throw new Error('Could not find versions')
    for (const version of versions) {
        if (!isString(version)) {
            throw new Error('Some version is not a string')
        }
    }
    return { versions: versions as string[] }
}
