import { EOL } from "os"

function isWhiteSpace(chr: string): boolean {
    return chr === ' ' || chr === '\r' || chr === '\n' || chr === '\t' || chr === '\f'
}

function splitLines(str: string): string[] {
    return str.split(EOL)
}

type Token = { type: 'whitespace' | 'continuation' | 'normal' | 'escaped'; value: string }
/**
 * Tokenize line, resolve escapes, trim leading whitespaces
 */
function tokenizeLine(line: string): Token[] {
    if (line.length === 0) return []

    const ret: Token[] = []
    for (let i = 0; i < line.length;) {
        if (line.charAt(i) === '\\') {
            ++i
            if (i === line.length) {
                // line continuation
                ret.push({ type: 'continuation', value: '\\' })
            } else if (line.charAt(i) !== 'u') {
                // escaped character
                let escaped = line.charAt(i)
                switch (escaped) {
                    case 'r': escaped = '\r'; break
                    case 'n': escaped = '\n'; break
                    case 't': escaped = '\t'; break
                    case 'f': escaped = '\f'; break
                }
                ret.push({ type: 'escaped', value: escaped })
                ++i
            } else {
                ++i
                const utf16 = line.substring(i, i + 4) // j+4 is treated as line.length when larger than line.length
                if (!/^[0-9a-fA-F]{4}$/.test(utf16))
                    throw new Error(`Malformed \\uxxxx encoding: \\u${utf16}`)
                ret.push({
                    type: 'escaped',
                    value: String.fromCharCode(parseInt(utf16, 16))
                })
                i += 4
            }
        } else {
            const start = i
            const whitespace = isWhiteSpace(line.charAt(start))
            do ++i
            while (
                i < line.length &&
                isWhiteSpace(line.charAt(i)) === whitespace &&
                line.charAt(i) !== '\\'
            )
            if (ret.length > 0 || !whitespace)
                // do not insert leading whitespaces
                ret.push({
                    type: whitespace ? 'whitespace' : 'normal',
                    value: line.substring(start, i)
                })
        }
    }
    return ret
}

/**
 * @param logicalLine: a logical line of tokens without line continuations or leading whitespaces
 */
function parseLogicalLine(logicalLine: Token[]): { key: string; value: string } | undefined {
    if (logicalLine.length === 0) return undefined

    let key: string
    let value: string

    let itoken = 0
    let iassignment = -1
    for (; itoken < logicalLine.length; ++itoken) {
        const token = logicalLine[itoken]
        if (
            token.type === 'whitespace' ||
            (token.type === 'normal' &&
                ((iassignment = token.value.indexOf('=')) > -1 ||
                    (iassignment = token.value.indexOf(':')) > -1))
        ) {
            break
        }
    }
    // itoken lands on the first whitespace,
    // or normal token with assigment symbol,
    // or >= logicalLine.length

    key = logicalLine.slice(0, itoken).map(token => token.value).join('')
    if (iassignment !== -1) {
        const token = logicalLine[itoken]
        key += token.value.substring(0, iassignment)
    } else {  // when itoken lands on a whitespace
        for (++itoken; itoken < logicalLine.length; ++itoken) {
            const token = logicalLine[itoken]
            if (token.type !== 'whitespace') {
                if (
                    token.type === 'normal' &&
                    (iassignment = token.value.indexOf('=')) === -1
                )
                    iassignment = token.value.indexOf(':')
                break
            }
        }
    }

    // non-whitespace token or exhaust all tokens
    value = ''
    if (iassignment !== -1) {
        const token = logicalLine[itoken]
        if (iassignment < token.value.length - 1) {
            // value starts immediately after assignment symbol
            value = token.value.substring(iassignment + 1)
            ++itoken
        } else {
            // skip whitespaces after assignment symbol
            do ++itoken
            while (
                itoken < logicalLine.length &&
                logicalLine[itoken].type === 'whitespace'
            )
        }
    }
    value += logicalLine
        .slice(itoken)
        .map(token => token.value)
        .join('')

    return { key, value }
}

function escapeKey(key: string): string {
    let ret = ''
    let start = 0
    for (let i = 0; i < key.length; ++i) {
        const char = key.charAt(i)
        let newChar = char
        const code = char.charCodeAt(0)
        switch (char) {
            case ' ': newChar = '\\ '; break
            case '\r': newChar = '\\r'; break
            case '\n': newChar = '\\n'; break
            case '\t': newChar = '\\t'; break
            case '\f': newChar = '\\f'; break
            case '=': newChar = '\\='; break
            case ':': newChar = '\\:'; break
            case '#': if (i === 0) newChar = '\\#'; break
            case '!': if (i === 0) newChar = '\\!'; break
            default:
                if (code > 0x7f) newChar = `\\u${code.toString(16).padStart(4, '0')}`
                break
        }
        if (newChar.length !== char.length) {
            if (start < i) {
                ret += key.substring(start, i)
            }
            ret += newChar
            start = i + 1
        }
    }
    if (start < key.length) {
        ret += key.substring(start)
    }
    return ret
}

function escapeValue(value: string): string {
    let ret = ''
    let start = 0
    for (let i = 0; i < value.length; ++i) {
        const char = value.charAt(i)
        let newChar = char
        const code = char.charCodeAt(0)
        switch (char) {
            case ' ': newChar = '\\ '; break
            case '\r': newChar = '\\r'; break
            case '\n': newChar = '\\n'; break
            case '\t': newChar = '\\t'; break
            case '\f': newChar = '\\f'; break
            default:
                if (code > 0x7f) newChar = `\\u${code.toString(16).padStart(4, '0')}`
                break
        }
        if (newChar.length !== char.length) {
            if (start < i) {
                ret += value.substring(start, i)
            }
            ret += newChar
            start = i + 1
        }
    }
    if (start < value.length) {
        ret += value.substring(start)
    }
    return ret
}

type PropertyEntry = { ignored: boolean; value: string }
/**
 * See https://docs.oracle.com/en/java/javase/19/docs/api/java.base/java/util/Properties.html#load(java.io.Reader)
 */
export class Properties {
    private entries: PropertyEntry[] = []
    private values: Map<string, string> = new Map()

    static fromString(input: string): Properties {
        const ret = new Properties()
        const linesOfKey = new Map<string, { from: number, to: number, entryId: number }>()
        const lines = splitLines(input)
        for (let iline = 0; iline < lines.length; ++iline) {
            let tokens = tokenizeLine(lines[iline])
            // blank or comment line
            if (
                tokens.length === 0 ||
                (tokens[0].type === 'normal' && (tokens[0].value.startsWith('#') || tokens[0].value.startsWith('!')))
            ) {
                ret.entries.push({ ignored: true, value: lines[iline] })
            } else {
                // should have no continuation or leading whitespaces
                const logicalLine: Token[] = tokens.filter(
                    token => token.type !== 'continuation'
                )
                const startLine = iline

                while (tokens.length > 0 && tokens[tokens.length - 1].type === 'continuation' && iline < lines.length - 1) {
                    tokens = tokenizeLine(lines[++iline])
                    for (const token of tokens) {
                        if (token.type !== 'continuation') {
                            logicalLine.push(token)
                        }
                    }
                }

                let parseResult = parseLogicalLine(logicalLine)
                // Java's quirk
                if (parseResult === undefined && iline >= lines.length - 1 && /\\[\r\n]?$/.test(input.slice(-2)))
                    parseResult = { key: '', value: '' }
                if (parseResult !== undefined) {
                    const { key, value } = parseResult
                    if (ret.values.has(key)) {
                        const { from, to, entryId } = linesOfKey.get(key)!
                        ret.entries[entryId] = { ignored: true, value: lines.slice(from, to + 1).join('\n') }
                    }
                    ret.entries.push({ ignored: false, value: parseResult.key })
                    ret.values.set(key, value)
                    linesOfKey.set(key, { from: startLine, to: iline, entryId: ret.entries.length - 1 })
                } else {
                    ret.entries.push({ ignored: true, value: lines.slice(startLine, iline + 1).join('\n') })
                }
            }
        }
        return ret
    }

    get(key: string): string | undefined {
        return this.values.get(key)
    }

    set(key: string, value: string): void {
        this.values.set(key, value)
    }

    toString(): string {
        const ret = []
        for (const entry of this.entries) {
            if (entry.ignored) {
                ret.push(entry.value)
            } else {
                ret.push(`${escapeKey(entry.value)}=${escapeValue(this.get(entry.value)!)}`)
            }
        }
        return ret.join('\n')
    }
}
