import * as network from "../src/network"

describe('fetchLatestVersions', () => {
    it('normal', async () => {
        const versions = await network.fetchLatestMcVersions()
        expect(versions).toBeInstanceOf(Map)
        expect(versions.size).toBeGreaterThan(0)
    })
})

describe('fetchMavenVersion', () => {
    const testRepo = 'https://maven.neoforged.net/releases'
    const testGroupId = 'net.neoforged'
    const testArtifactId = 'neoforge'

    it('normal', async () => {
        const versions = await network.fetchMavenMeta(testRepo, testGroupId, testArtifactId)
        expect(Array.isArray(versions)).toBeTruthy()
        expect(versions?.length).toBeGreaterThan(0)
        for (const entry of versions as [])
            expect(typeof entry).toEqual('string')
    })

    it('wrong-path', async () => {
        await expect(network.fetchMavenMeta(testRepo, testGroupId, 'unobtainium'))
            .rejects.toBeTruthy()
        await expect(network.fetchMavenMeta(testRepo, 'unobtainium', testArtifactId))
            .rejects.toBeTruthy()
    })

    it('wrong-url', async () => {
        await expect(network.fetchMavenMeta('http://example.com/', testGroupId, testArtifactId))
            .rejects.toBeTruthy()
    })
})

