import * as core from '@actions/core'
import { XMLParser } from 'fast-xml-parser'
import { isString } from '../utils'

const MAVEN_META_PARSER = new XMLParser({
    numberParseOptions: {  // don't parse versions like *.*
        hex: false,
        leadingZeros: false,
        skipLike: /.*/
    },
    isArray: (_: string, jpath: string): boolean => {  // versions should always be a list
        switch (jpath) {
            case 'metadata.versioning.versions.version':
                return true
            default:
                return false
        }
    }
})

/**
 * Returns a list of versions from A Level Metadata
 * See https://maven.apache.org/repositories/metadata.html#the-a-level-metadata
 */
export async function fetchMavenMeta(repo: string, groupId: string, artifactId: string): Promise<{ versions: string[] }> {
    const path = `${groupId.replaceAll('.', '/')}/${artifactId}/maven-metadata.xml`
    const repoClean = repo.endsWith('/') ? repo : `${repo}/`
    const url = new URL(path, repoClean)
    core.debug(`Try to fetch request to ${url.toString()}`)
    const resp = await fetch(url)
    if (!resp.ok)
        throw new Error(`Not 2xx status code: ${resp.status}`)
    const text = await resp.text()
    const xml = MAVEN_META_PARSER.parse(text)
    const versions = xml.metadata?.versioning?.versions?.version
    if (Array.isArray(versions)) {
        for (const version of versions) if (!isString(version))
            throw new Error('Some version is not a string')
    } else {
        throw new Error('Could not find versions')
    }
    return { versions: versions as string[] }
}

