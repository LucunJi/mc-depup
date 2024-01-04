import * as core from '@actions/core'


export class GitHubVariables {
    readonly updateMcPatch = core.getInput('update_mc_patch').toLowerCase() === 'true'
    readonly updateOnlyWithMc = core.getInput('update_only_with_mc').toLowerCase() === 'true'
    readonly tolerable = core.getInput('tolerable').toLowerCase() === 'true'

    setAnyUpdate(val: boolean): void {
        core.setOutput('any_update', val)
    }
}

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

export function isString<T>(x: T): T extends (string | String) ? true : false {
    const ret =  (typeof x === 'string') || (x instanceof String)
    return ret as T extends (string | String) ? true : false 
}
