import { McVersion } from "../src/utils"

describe('McVersion', () => {
    it('compare', async () => {
        expect(new McVersion(1, 1, 1).compare(new McVersion(1, 1, 1))).toEqual(0)
        expect(new McVersion(1, 1, 1).compare(new McVersion(1, 1, 0))).toBeGreaterThan(0)
        expect(new McVersion(1, 1, 1).compare(new McVersion(1, 0, 1))).toBeGreaterThan(0)
        expect(new McVersion(1, 1, 1).compare(new McVersion(0, 1, 1))).toBeGreaterThan(0)
        expect(new McVersion(1, 1, 0).compare(new McVersion(1, 1, 1))).toBeLessThan(0)
        expect(new McVersion(1, 0, 1).compare(new McVersion(1, 1, 1))).toBeLessThan(0)
        expect(new McVersion(0, 1, 1).compare(new McVersion(1, 1, 1))).toBeLessThan(0)
    })
})
