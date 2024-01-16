import { DependencyVersion, McVersion } from "../src/version"

describe('McVersion.compare', () => {
    it('normal', async () => {
        expect(new McVersion(1, 1, 1).compare(new McVersion(1, 1, 1))).toEqual(0)
        expect(new McVersion(1, 1, 1).compare(new McVersion(1, 1, 0))).toBeGreaterThan(0)
        expect(new McVersion(1, 1, 1).compare(new McVersion(1, 0, 1))).toBeGreaterThan(0)
        expect(new McVersion(1, 1, 1).compare(new McVersion(0, 1, 1))).toBeGreaterThan(0)
        expect(new McVersion(1, 1, 0).compare(new McVersion(1, 1, 1))).toBeLessThan(0)
        expect(new McVersion(1, 0, 1).compare(new McVersion(1, 1, 1))).toBeLessThan(0)
        expect(new McVersion(0, 1, 1).compare(new McVersion(1, 1, 1))).toBeLessThan(0)
    })
})

describe('DependencyVersion.constructor', () => {
    it('normal', async () => {
        const actual = new DependencyVersion('1.2.1-mc1.7.10-alpha+build.1123')
        expect(actual.parts).toEqual(expect.arrayContaining([
            1, 2, 1, 'mc', 1, 7, 10, 'build', 1123
        ]))
    })
})

describe('DependencyVersion.compare', () => {
    it('numbers', async () => {
        expect(new DependencyVersion('1.2.1').compare(new DependencyVersion('1.2.0')) > 0)
            .toBeTruthy()
        expect(new DependencyVersion('1.1.2').compare(new DependencyVersion('1.2.1')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('2.1.2').compare(new DependencyVersion('1.2.2')) > 0)
            .toBeTruthy()
        expect(new DependencyVersion('2.1.2').compare(new DependencyVersion('2-1-2')) === 0)
            .toBeTruthy()
    })

    it('alphabets', async () => {
        expect(new DependencyVersion('a').compare(new DependencyVersion('A')) > 0)
            .toBeTruthy()
        expect(new DependencyVersion('a').compare(new DependencyVersion('b')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('aa').compare(new DependencyVersion('a')) > 0)
            .toBeTruthy()
    })

    it('alphabets-special', async () => {
        expect(new DependencyVersion('rc').compare(new DependencyVersion('snapshot')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('snapshot').compare(new DependencyVersion('final')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('final').compare(new DependencyVersion('ga')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('ga').compare(new DependencyVersion('release')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('release').compare(new DependencyVersion('sp')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('rc').compare(new DependencyVersion('RC')) === 0)
            .toBeTruthy()
    })

    it('mixed', async () => {
        expect(new DependencyVersion('1.1.1').compare(new DependencyVersion('1.a.1')) > 0)
            .toBeTruthy()
        expect(new DependencyVersion('a.1.1').compare(new DependencyVersion('1.1.a')) < 0)
            .toBeTruthy()
    })

    it('extras', async () => {
        expect(new DependencyVersion('1.1.1').compare(new DependencyVersion('1.1.1.1')) < 0)
            .toBeTruthy()
        expect(new DependencyVersion('1.1.1').compare(new DependencyVersion('1.1.1.a')) > 0)
            .toBeTruthy()
    })
})
