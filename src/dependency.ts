/**
 * Manages dependency configuration
 */

import * as yml from 'yaml'
import { promises as fs } from 'fs'
import { isString } from './utils'
import { McVersion, DependencyVersion } from './version'
import escapeStringRegexp from "escape-string-regexp"


// variable
export type Variable = {
    name: string
    source: 'version'
    | 'artifactId'
    | 'named_wildcard'      // default option
}
const VALID_VARIABLE_SOURCES: Variable['source'][] = [
    'version', 'artifactId', 'named_wildcard'
]
export type VariableContext = {
    mcVersion: McVersion
}
function variableExpander(name: string): ((ctx: VariableContext) => string) | undefined {
    switch (name) {
        case 'minecraft_version': return (ctx: VariableContext): string => ctx.mcVersion.toString(false); // sugar for mcVersion
        case 'mcVersion': return (ctx: VariableContext): string => ctx.mcVersion.toString(false);
        case 'mcVersionFull': return (ctx: VariableContext): string => ctx.mcVersion.toString(true); // sugar for using major, minor and patch explicitly
        case 'mcMajor': return (ctx: VariableContext): string => ctx.mcVersion.major.toString();
        case 'mcMinor': return (ctx: VariableContext): string => ctx.mcVersion.minor.toString();
        case 'mcPatch': return (ctx: VariableContext): string => ctx.mcVersion.patch.toString();
        default: return undefined
    }
}


// pattern
export class PatternPart {
    readonly hasCaptureGroup: boolean

    constructor(
        readonly type: 'literal' // plain string
            | 'variable'    // variable that is replaced with actual value in context
            | 'named_wildcard'      // RegExp /(.*)/ and the captured is compared as a SemVer 
            | 'wildcard',           // RegExp /(.*)/ and the captured is compared as a SemVer 
        readonly value: string
    ) {
        switch (type) {
            case 'wildcard': case 'named_wildcard':
                this.hasCaptureGroup = true
            default:
                this.hasCaptureGroup = false
        }
    }

    /**
     * @returns a part of RegExp that is NOT ESCAPED
     */
    contextualize(context: VariableContext, escapeLiteralResult: boolean): string {
        let ret: string
        switch (this.type) {
            case 'literal': ret = this.value; break
            case 'variable': ret = variableExpander(this.value)!(context); break;
            case 'wildcard': case 'named_wildcard': ret = '(.*)'; break
        }
        if (escapeLiteralResult) {
            switch (this.type) {
                case 'literal': case 'variable':
                    ret = escapeStringRegexp(ret)
            }
        }
        return ret
    }
}


// DependencySettings
export class DependencySettings {
    readonly dependencies: Dependency[]

    constructor(input: string) {
        this.dependencies = readDependencies(input)
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
        readonly variables: Map<string, Variable>,
    ) {
        this.versionCaptureTypes = []
        for (const part of version) {
            if (part.hasCaptureGroup)
                this.versionCaptureTypes.push(part.type)
        }
    }

    contextualize(context: VariableContext): ContextualizedDependency {
        const artifactId = this.artifactId.map(part => part.contextualize(context, false)).join()
        const version = `^${this.artifactId.map(part => part.contextualize(context, true)).join()}$`
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

function bracketType(name: string): PatternPart['type'] {
    return variableExpander(name) === undefined ? 'variable' : 'named_wildcard'
}

function checkArtifactIdParts(artifactId: PatternPart[]) {
    for (const part of artifactId) {
        if (!(part.type === 'literal' || part.type === 'variable'))
            throw new Error('artifactId can only contain literals or variables')
    }
}

function readDependencies(input: string): Dependency[] {
    const doc = yml.parse(input)
    if (!Array.isArray(doc))
        throw new Error('Configuration must be an array')

    const ret: Dependency[] = []
    for (const entry of doc) {
        const repository = entry['repository']
        const groupId = entry['groupId']
        const artifactId = entry['artifactId']
        const version = entry['version']
        const variables = entry['variables']

        if (!isString(repository))
            throw new Error('repository must be a string')
        if (!isString(groupId))
            throw new Error('groupId must be a string')

        if (!isString(artifactId))
            throw new Error('artifactId must be a string')
        const parsedArtifactId = parsePattern(artifactId)
        checkArtifactIdParts(parsedArtifactId)

        if (!isString(version))
            throw new Error('version must be a string')
        const parsedVersion = parsePattern(version)

        const actualVariables = new Map<string, Variable>()
        for (const part of parsedVersion) {
            if (part.type === 'named_wildcard') {
                actualVariables.set(part.value, {
                    name: part.value,
                    source: 'named_wildcard'
                })
            }
        }
        if (!Array.isArray(variables))
            throw new Error('variables must be an array')
        for (const variable of variables) {
            const content = Object.entries(variable)
            if (content.length !== 1)
                throw new Error('Each entry in variables must be a mapping from a name to a string')
            const [varName, varSource] = content[0]
            if (!isString(varName) || VALID_VARIABLE_SOURCES.indexOf(varSource as Variable['source']) === -1) {
                throw new Error(`Each entry in variables must be a mapping from a name to any of ${VALID_VARIABLE_SOURCES.map(s => `'${s}'`).join(', ')
                    }`)
            }
            if (varSource === 'semver' && !actualVariables.has(varName))
                throw new Error(`To declare '${varName}' as a semver pattern, it must be included in the pattern of version`)

            actualVariables.set(varName, {
                name: varName,
                source: varSource as Variable['source']
            })
        }

        ret.push(new Dependency(
            repository as string,
            groupId as string,
            parsedArtifactId,
            parsedVersion,
            actualVariables
        ))
    }

    return ret
}

function parsePattern(pattern: string): PatternPart[] {
    if (pattern.length === 0)
        return []

    let parts: PatternPart[] = []

    // This allows more flexibility if we want to add more patterns,
    // as all patterns are processed in one-go
    let start = 0
    let i = 0
    do {
        let nonLiteralPart: PatternPart | undefined
        const end = i
        let isWildcard = false
        switch (pattern[i]) {
            case '*':
                nonLiteralPart = new PatternPart('wildcard', '')
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
                const name = pattern.slice(i + 1, right)
                nonLiteralPart = new PatternPart(bracketType(name), name)
                i = right + 1
                break
            }
            default:
                ++i
                break
        }

        if (nonLiteralPart !== undefined) {
            // start <= end < pattern.length
            if (end > start) {
                parts.push(new PatternPart('literal', pattern.slice(start, end)))
            }
            start = i
            parts.push(nonLiteralPart)
        }
    } while (i < pattern.length)

    if (start < pattern.length) {
        let part = pattern.slice(start)
        parts.push(new PatternPart('literal', part))
    }

    return parts
}
