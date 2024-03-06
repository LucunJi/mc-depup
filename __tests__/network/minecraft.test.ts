import * as network from "../../src/network/minecraft"

describe('fetchLatestVersions', () => {
    it('normal', async () => {
        const versions = await network.fetchLatestMcPatches()
        expect(versions).toBeInstanceOf(Map)
        expect(versions.size).toBeGreaterThan(0)
    })
})
