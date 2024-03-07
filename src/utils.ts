import * as core from '@actions/core'


function booleanInput(key: string, defaultVal: boolean): boolean {
    const input = core.getInput(key)
    return input.length === 0 ? defaultVal : input.toLowerCase() === 'true'
}

function stringInput(key: string, defaultVal: string): string {
    const input = core.getInput(key)
    return input.length === 0 ? defaultVal : input
}

export class GitHubVariables {
    readonly configPath = stringInput('config_path', './.github/modding-dependencies.yml')
    readonly updateMcPatch = booleanInput('update_mc_patch', true)
    readonly updateOnlyWithMc = booleanInput('update_only_with_mc', false)
    readonly tolerable = booleanInput('tolerable', false)
    readonly dryRun = booleanInput('dry_run', false)

    setAnyUpdate(val: boolean): void {
        core.setOutput('any_update', val)
    }

    setSummary(val: string): void {
        core.setOutput('summary', val)
    }
}

export function isString<T>(x: T): boolean {
    return typeOf(x) === 'string'
}

export function isObject<T>(x: T): boolean {
    return typeOf(x) === 'object'
}

type TypeInfo =
    'undefined' | 'null' | 'string' | 'number' | 'boolean' | 'symbol' | 'array' | 'object'
export function typeOf<T>(x: T): TypeInfo {
    if (x === undefined)
        return 'undefined'
    else if (x === null)
        return 'null'
    else if ((typeof x === 'string') || (x instanceof String))
        return 'string'
    else if ((typeof x === 'number') || (x instanceof Number))
        return 'number'
    else if ((typeof x === 'boolean') || (x instanceof Boolean))
        return 'boolean'
    else if ((typeof x === 'symbol') || (x instanceof Symbol))
        return 'symbol'
    else if (Array.isArray(x))
        return 'array'
    else
        return 'object'
}
