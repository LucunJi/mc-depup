import * as core from '@actions/core'


export class GitHubVariables {
    readonly updateMcPatch = core.getInput('update_mc_patch').toLowerCase() === 'true'
    readonly updateOnlyWithMc = core.getInput('update_only_with_mc').toLowerCase() === 'true'
    readonly tolerable = core.getInput('tolerable').toLowerCase() === 'true'

    setAnyUpdate(val: boolean): void {
        core.setOutput('any_update', val)
    }
}

export function isString<T>(x: T): T extends string ? true : false {
    const ret =  (typeof x === 'string') || (x instanceof String)
    return ret as T extends string ? true : false 
}
