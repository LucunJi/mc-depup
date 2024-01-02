import { Properties } from '../src/properties'

describe('properties-parsing', () => {
    it('normal', async () => {
        const input = `
# comments
       

a = 1

# comments
b=2

c = 3
d: 4
e\t5`
        const properties = Properties.fromString(input)
        expect(properties.get('a')).toStrictEqual('1')
        expect(properties.get('b')).toStrictEqual('2')
        expect(properties.get('c')).toStrictEqual('3')
        expect(properties.get('d')).toStrictEqual('4')
        expect(properties.get('e')).toStrictEqual('5')
    })

    it('multiline', async () => {
        const input = `
    \\
a   \\
    = 1
b= \\
    2

c \\
    = \\
    3
d\\
    : \\
    4
e\t\\
    \\
    5`
        const properties = Properties.fromString(input)
        expect(properties.get('a')).toStrictEqual('1')
        expect(properties.get('b')).toStrictEqual('2')
        expect(properties.get('c')).toStrictEqual('3')
        expect(properties.get('d')).toStrictEqual('4')
        expect(properties.get('e')).toStrictEqual('5')
    })

    it('escape', async () => {
        const input = `
a\\=1=1
b\\:\\=2=2\\u1234
c\\\t\\t\\f\\r\\n \\
    3\t4
d\\\\\\\\:\\\\\\\\4
e\\ \\
    5 \\
    5
`
        const properties = Properties.fromString(input)
        expect(properties.get('a=1')).toStrictEqual('1')
        expect(properties.get('b:=2')).toStrictEqual('2\u1234')
        expect(properties.get('c\t\t\f\r\n')).toStrictEqual('3\t4')
        expect(properties.get('d\\\\')).toStrictEqual('\\\\4')
        expect(properties.get('e 5')).toStrictEqual('5')
    })

    it('keyonly', async () => {
        const input = `
a
b\\:\\=\\
    \\

c\t\t\\
    
\t\td
    e  \\

`
        const properties = Properties.fromString(input)
        expect(properties.get('a')).toStrictEqual('')
        expect(properties.get('b:=')).toStrictEqual('')
        expect(properties.get('c')).toStrictEqual('')
        expect(properties.get('d')).toStrictEqual('')
        expect(properties.get('e')).toStrictEqual('')
    })

    it('quirks', async () => {
        let properties = Properties.fromString('   \\\n   \\\n')
        expect(properties.get('')).toStrictEqual('')
        properties = Properties.fromString('   \\\n   \\')
        expect(properties.get('')).toStrictEqual('')
        properties = Properties.fromString('   \\\n   \\\r\n')
        expect(properties.get('')).toStrictEqual(undefined)
        properties = Properties.fromString('   \\\n   \\\n ')
        expect(properties.get('')).toStrictEqual(undefined)
    })
})

describe('properties-entries', () => {
    it('all', async () => {
        const input = `
# some comment
a = 1
  ! other comments
b = 3
c = hello \\
    world
b = 5
c = hello \\
    world \\
    !
    \\
    \\
  
= 0`
        const properties = Properties.fromString(input)
        const entries = properties['entries']
        expect(entries[0]).toStrictEqual({ignored: true, value: ''})
        expect(entries[1]).toStrictEqual({ignored: true, value: '# some comment'})
        expect(entries[2]).toStrictEqual({ignored: false, value: 'a'})
        expect(entries[3]).toStrictEqual({ignored: true, value: '  ! other comments'})
        expect(entries[4]).toStrictEqual({ignored: true, value: 'b = 3'})
        expect(entries[5]).toStrictEqual({ignored: true, value: 'c = hello \\\n    world'})
        expect(entries[6]).toStrictEqual({ignored: false, value: 'b'})
        expect(entries[7]).toStrictEqual({ignored: false, value: 'c'})
        expect(entries[8]).toStrictEqual({ignored: true, value: '    \\\n    \\\n  '})
        expect(entries[9]).toStrictEqual({ignored: false, value: ''})
    })
})

describe('properties-save', () => {
    it('all', async () => {
        const input = `
# comments

    \\
        \\
  

a = 1

# comments
b=2

c = 3
d: 4
e\t5
f=\\t\\t\u65b0\u5e74\u5feb\u4e50\\f\\f\\r\\n`
        const properties = Properties.fromString(input)
        const output = properties.toString()
        const newProperties = Properties.fromString(output)
        expect(newProperties['entries']).toStrictEqual(properties['entries'])
        expect(newProperties['values']).toStrictEqual(properties['values'])

    })
})
