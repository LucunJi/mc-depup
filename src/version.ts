/**
 * Versioning of Minecraft and other dependencies
 */

import { isString } from './utils'

export class McVersion {
    constructor(
        readonly major: number,
        readonly minor: number,
        readonly patch: number
    ) { }

    static fromString(version: string): McVersion {
        const parts = version.split('.')
        return new McVersion(
            parseInt(parts[0] ?? '0'),
            parseInt(parts[1] ?? '0'),
            parseInt(parts[2] ?? '0')
        )
    }

    toString(full = false): string {
        let ret = `${this.major}.${this.minor}`
        if (this.patch > 0 || full)
            ret += `.${this.patch}`
        return ret
    }

    compare(other: McVersion): number {
        if (this.major > other.major) return 1
        else if (this.major < other.major) return -1
        else if (this.minor > other.minor) return 1
        else if (this.minor < other.minor) return -1
        else if (this.patch > other.patch) return 1
        else if (this.patch < other.patch) return -1
        else return 0
    }
}

// Currently, we do not have intelligence for Minecraft version and distribution keywords
// This might be implemented in the future

// const VERSION_PART = /([^0-9a-zA-Z]?)(?:(\d+)|([a-zA-Z]+))/g
// const DISTS = new Set(['kotlin', 'java', 'scala', 'fabric', 'quilt', 'neo', 'forge'])
// const IGNORED = new Set<string>(DISTS)
// for (const c in ['mc', 'v']) IGNORED.add(c)

const VERSION_PART = /(\d+)|([a-zA-Z]+)/g
// this order matters, and 'dev' must be at position 0
const SPECIALS = ['dev', 'rc', 'snapshot', 'final', 'ga', 'release', 'sp']

export class DependencyVersion {
    //     readonly dists = new Set<string>()
    //     readonly mcVersion?: (string|number)[]
    //     readonly dotGroups: (string|number)[][] = []
    readonly parts: (string | number)[] = []

    constructor(versionStr: string) {
        for (const match of versionStr.trim().matchAll(VERSION_PART)) {
            if (match[1] !== undefined) {  // numerical part
                this.parts.push(parseInt(match[1]))
            } else {
                this.parts.push(match[2])
            }
        }
    }

    /**
     * See: https://docs.gradle.org/current/userguide/single_versions.html#version_ordering
     */
    compare(other: DependencyVersion): number {
        for (let i = 0; this.parts[i] !== undefined || other.parts[i] !== undefined; ++i) {
            const x = this.parts[i]; const y = other.parts[i]
            const xIsString = isString(x); const yIsString = isString(y)
            // being undefined means the index is out of range in a versioning with less parts
            const xIsUndef = x === undefined; const yIsUndef = y === undefined
            const xIsNumber = !xIsString && !xIsUndef; const yIsNumber = !yIsString && !yIsUndef

            let cmp: number
            if (xIsNumber && yIsNumber) {
                cmp = (x as number) - (y as number)
            } else if (xIsNumber) {  // numeric > letters or empty
                cmp = 1
            } else if (yIsNumber) {
                cmp = -1
            } else if (xIsString && yIsString) {  // from this point, none of x and y can be numerical
                const xRank = SPECIALS.indexOf((x as string).toLowerCase())
                const yRank = SPECIALS.indexOf((y as string).toLowerCase())
                if (xRank !== -1 && yRank !== -1) {
                    cmp = xRank - yRank
                } else if (xRank !== -1) {
                    cmp = xRank === 0 ? -1 : 1
                } else if (yRank !== -1) {
                    cmp = yRank === 0 ? 1 : -1
                } else {  // both are non-special
                    cmp = compareStringLexigraphically(x as string, y as string)
                }
            } else if (xIsString) {  // y is undefined here, and letters are smaller than empty
                cmp = -1
            } else {  // x and y can't be both undefined
                cmp = 1
            }

            if (cmp !== 0) return cmp
        }
        return 0
    }
}

function compareStringLexigraphically(x: string, y: string): number {
    for (let j = 0; j < x.length || j < y.length; ++j) {
        const cx = x.charCodeAt(j); const cy = y.charCodeAt(j)
        if (Number.isNaN(cx)) {
            return -1
        } else if (Number.isNaN(cy)) {
            return 1
        } else if (cx !== cy) {
            return cx - cy
        }
    }
    return 0
}
