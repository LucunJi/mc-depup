import { McVersion } from './version'
import escapeStringRegexp from "escape-string-regexp"

export type PatternContext = {
    mcVersion: McVersion
    omitMcPatch: boolean
}

export function getContextualWildcardExpander(name: string):
    ((ctx: PatternContext) => string) | undefined {
    switch (name) {
        case 'mcVersion': return (ctx: PatternContext):
            string => ctx.mcVersion.toString(!ctx.omitMcPatch)
        case 'mcMajor': return (ctx: PatternContext):
            string => ctx.mcVersion.major.toString()
        case 'mcMinor': return (ctx: PatternContext):
            string => ctx.mcVersion.minor.toString()
        case 'mcPatch': return (ctx: PatternContext):
            string => ctx.mcVersion.patch.toString()
        default: return undefined
    }
}

export function isWildcardNameContextual(name: string): boolean {
    return getContextualWildcardExpander(name) !== undefined
}

export class PatternPart {
    readonly hasCaptureGroup: boolean

    constructor(
        readonly type: 'literal' // plain string
            | 'contextual_wildcard'    // replaced with actual value in context
            | 'named_wildcard'      // RegExp /(.*)/ and the captured is compared as a SemVer 
            | 'wildcard',           // RegExp /(.*)/ and the captured is compared as a SemVer 
        readonly value: string
    ) {
        switch (this.type) {
            case 'wildcard': case 'named_wildcard':
                this.hasCaptureGroup = true
                break
            default:
                this.hasCaptureGroup = false
                break
        }
    }

    /**
     * @returns a part of RegExp properly escaped
     */
    contextualize(context: PatternContext, escapeLiteralResult: boolean): string {
        let ret: string
        switch (this.type) {
            case 'literal': ret = this.value; break
            case 'contextual_wildcard': ret = getContextualWildcardExpander(this.value)!(context); break
            case 'wildcard': case 'named_wildcard': ret = '(.*)'; break
        }
        if (escapeLiteralResult) {
            switch (this.type) {
                case 'literal': case 'contextual_wildcard':
                    ret = escapeStringRegexp(ret)
            }
        }
        return ret
    }
}


export function parsePattern(pattern: string): PatternPart[] {
    if (pattern.length === 0)
        return []

    const parts: PatternPart[] = []

    // This allows more flexibility if we want to add more patterns,
    // as all patterns are processed in one-go
    let start = 0
    let i = 0
    do {
        let nonLiteralPart: PatternPart | undefined
        const end = i
        switch (pattern[i]) {
            case '*':
                nonLiteralPart = new PatternPart('wildcard', '')
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
                nonLiteralPart = new PatternPart(isWildcardNameContextual(name) ? 'contextual_wildcard' : 'named_wildcard', name)
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
        const part = pattern.slice(start)
        parts.push(new PatternPart('literal', part))
    }

    return parts
}
