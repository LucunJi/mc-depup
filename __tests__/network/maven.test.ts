import * as network from "../../src/network/maven"

describe('fetchMavenVersion', () => {
    // the version lists used for test should be unlikely to be changed be changed in the future 
    const testRepo = 'https://masa.dy.fi/maven'
    const testGroupId = 'fi.dy.masa.malilib'

    it('multi-versions', async () => {
        const versions = await network.fetchMavenMeta(testRepo, testGroupId, 'malilib-1.12.1')
        expect(versions).toEqual(expect.objectContaining({
            'versions': expect.arrayContaining(['0.10.0-dev.24+pre.1', '0.8.0'])
        }))
    })

    it('single-version', async () => {
        const versions = await network.fetchMavenMeta(testRepo, testGroupId, 'malilib-fabric-1.14.3')
        expect(versions).toEqual(expect.objectContaining({
            'versions': expect.arrayContaining(['0.10.0-dev.20'])
        }))
    })

    it('wrong-params', async () => {
        await expect(network.fetchMavenMeta(testRepo, testGroupId, 'unobtainium'))
            .rejects.toBeTruthy()
        await expect(network.fetchMavenMeta(testRepo, 'unobtainium', 'malilib-1.12.1'))
            .rejects.toBeTruthy()
        await expect(network.fetchMavenMeta('http://example.com/', testGroupId, 'malilib-1.12.1'))
            .rejects.toBeTruthy()
    })
})

