/**
 * Manages dependency settings
 */

import * as yml from 'yaml'
import { promises as fs } from 'fs'
import { typeOf } from './utils'
import { DependencyVersion } from './version'
import { PatternContext, PatternPart, parsePattern, isWildcardNameContextual } from './pattern'


export type Property = {
    name: string
    source: 'version'
    | 'artifactId'
    | 'wildcard'
    wildcardName?: string
}
const VALID_PROPERTY_SOURCES: Property['source'][] = [
    'version', 'artifactId', 'wildcard'
]


export type DependencyContext = PatternContext & {
    omitMcPatch: boolean
}


export class DependencySettings {
    readonly dependencies: Dependency[]

    constructor(settingsString: string) {
        this.dependencies = parseDependencies(settingsString)
    }

    static async readFromFile(path: string): Promise<DependencySettings> {
        const input = await fs.readFile(path)
        const inputDecoded = input.toString()
        const ret = new DependencySettings(inputDecoded)
        return ret
    }
}

export class Dependency {
    readonly versionCaptureTypes: PatternPart['type'][]

    constructor(
        readonly repository: string,
        readonly groupId: string,
        readonly artifactId: PatternPart[],
        readonly version: PatternPart[],
        readonly properties: Map<string, Property>,
    ) {
        this.versionCaptureTypes = []
        for (const part of version) {
            if (part.hasCaptureGroup)
                this.versionCaptureTypes.push(part.type)
        }
    }

    contextualize(context: DependencyContext): ContextualizedDependency {
        const artifactId = this.artifactId.map(part => part.contextualize(context, false)).join('')
        const version = `^${this.version.map(part => part.contextualize(context, true)).join('')}$`
        const versionRegExp = new RegExp(version)
        return new ContextualizedDependency(
            this,
            this.repository,
            this.groupId,
            artifactId,
            versionRegExp
        )
    }

    capturesToVersion(captures: string[]): DependencyVersion {
        if (captures.length !== this.versionCaptureTypes.length)
            throw new Error('Unmatched number of captures')

        let joined = ''
        for (let i = 0; i < this.versionCaptureTypes.length; ++i) {
            switch (this.versionCaptureTypes[i]) {
                case 'wildcard': case 'named_wildcard':
                    joined += '-'
                    joined += captures[i]
                    break
            }
        }
        return new DependencyVersion(joined)
    }
}

export class ContextualizedDependency {
    constructor(
        readonly parent: Dependency,
        readonly repository: string,
        readonly groupId: string,
        readonly artifactId: string,
        readonly version: RegExp,
    ) { }
}

function checkArtifactIdParts(artifactId: PatternPart[]): void {
    for (const part of artifactId) {
        if (!(part.type === 'literal' || part.type === 'contextual_wildcard'))
            throw new Error('artifactId can only contain literals or wildcards of Minecraft version')
    }
}

function parseDependencies(input: string): Dependency[] {
    const doc = yml.parse(input)
    if (!Array.isArray(doc))
        throw new Error('Settings must be an array')

    const ret: Dependency[] = []
    for (const entry of doc) {
        const repository = entry['repository']
        const groupId = entry['groupId']
        const artifactId = entry['artifactId']
        const version = entry['version']
        const properties = entry['properties']

        for (const [key, expectedType] of [
            ['repository', 'string'],
            ['groupId', 'string'],
            ['artifactId', 'string'],
            ['version', 'string'],
            ['properties', 'object'],
        ]) {
            const actualType = typeOf(entry[key])
            if (actualType !== expectedType)
                throw new Error(`${key} must exist as a ${expectedType}, but it is actually ${actualType}`)
        }

        const parsedArtifactId = parsePattern(artifactId)
        checkArtifactIdParts(parsedArtifactId)

        const parsedVersion = parsePattern(version)

        const actualProperties = new Map<string, Property>()
        // TODO: add this as a grammar sugar later on
        // for (const part of parsedVersion) {
        //     if (part.type === 'named_wildcard') {
        //         actualVariables.set(part.value, {
        //             name: part.value,
        //             source: 'wildcard'
        //         })
        //     }
        // }
        const namedWildcardNames = new Set<string>(
            parsedVersion.filter(part => part.type === 'named_wildcard').map(part => part.value)
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [propertyName, propertyAttrs] of Object.entries<any>(properties)) {
            const source = propertyAttrs['source']
            if (!VALID_PROPERTY_SOURCES.includes(source)) {
                throw new Error(`The source of property '${propertyName}' must be one of ${VALID_PROPERTY_SOURCES.join(', ')}`)
            }

            if (source === 'wildcard') {
                const wildcardName = propertyAttrs['name'] ?? propertyName
                if (!namedWildcardNames.has(wildcardName) && !isWildcardNameContextual(wildcardName)) {
                    throw new Error(`To give '${propertyName}' a wildcard source, a wildcard with name '${wildcardName}' must exist in the pattern of version`)
                }
                actualProperties.set(propertyName, {
                    name: propertyName,
                    source: source as Property['source'],
                    wildcardName: wildcardName
                })
            } else {
                actualProperties.set(propertyName, {
                    name: propertyName,
                    source: source as Property['source']
                })
            }
        }

        ret.push(new Dependency(
            repository as string,
            groupId as string,
            parsedArtifactId,
            parsedVersion,
            actualProperties
        ))
    }

    return ret
}
