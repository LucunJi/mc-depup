import { DependencySettings, Dependency, Property } from '../src/dependency'
import { PatternPart } from '../src/pattern'
import { McVersion } from '../src/version'


describe('Dependency.contextualize', () => {
    it('normal', async () => {
        const dependency = new Dependency(
            'dummy.repo', 'dummy.group',
            [new PatternPart('literal', '+-*/1234abcd'), new PatternPart('contextual_wildcard', 'mcVersion')],
            [
                new PatternPart('literal', '+-*/1234abcd'),
                new PatternPart('contextual_wildcard', 'mcMajor'), new PatternPart('literal', '.'),
                new PatternPart('contextual_wildcard', 'mcMinor'), new PatternPart('literal', '.'),
                new PatternPart('contextual_wildcard', 'mcPatch'),
                new PatternPart('wildcard', ''), new PatternPart('named_wildcard', 'dummy_name')
            ],
            new Map<string, Property>()
        )

        let actual = dependency.contextualize({ mcVersion: new McVersion(1, 20, 1), omitMcPatch: false })
        expect(actual).toEqual(expect.objectContaining({
            parent: dependency, repository: 'dummy.repo', groupId: 'dummy.group',
            artifactId: '+-*/1234abcd1.20.1'
        }))
        expect(actual.version.source).toEqual('^\\+\\x2d\\*\\/1234abcd1\\.20\\.1(.*)(.*)$')

        actual = dependency.contextualize({ mcVersion: new McVersion(1, 20, 0), omitMcPatch: true })
        expect(actual).toEqual(expect.objectContaining({
            parent: dependency, repository: 'dummy.repo', groupId: 'dummy.group',
            artifactId: '+-*/1234abcd1.20'
        }))
        expect(actual.version.source).toEqual('^\\+\\x2d\\*\\/1234abcd1\\.20\\.0(.*)(.*)$')
    })
})

describe('Dependency.capturesToVersion', () => {
    it('normal', async () => {
        const dependency = new Dependency(
            'dummy.repo', 'dummy.group', [],
            [
                new PatternPart('wildcard', ''), new PatternPart('literal', '-'),
                new PatternPart('contextual_wildcard', 'mcMajor'), new PatternPart('literal', '.'),
                new PatternPart('contextual_wildcard', 'mcMinor'), new PatternPart('literal', '.'),
                new PatternPart('contextual_wildcard', 'mcPatch'), new PatternPart('literal', '-'),
                new PatternPart('named_wildcard', 'dummy_name')
            ],
            new Map<string, Property>()
        )

        const contextualized = dependency.contextualize({ mcVersion: new McVersion(1, 20, 1), omitMcPatch: false })
        const captures = '1.0.1-1.20.1-alpha'.match(contextualized.version)!.slice(1)
        const actual = dependency.capturesToVersion(captures)
        expect(actual.parts).toEqual([1, 0, 1, 'alpha'])
    })
})

describe('DependencySettings.constructor', () => {
    it('normal1', async () => {
        const actual = new DependencySettings(`
- repository: https://maven.fabricmc.net
  groupId: net.fabricmc
  artifactId: fabric-loader
  version: "*"
  properties:
    loader_version:
      source: version
`)
        expect(actual).toEqual(expect.objectContaining({
            dependencies: expect.arrayContaining([
                expect.objectContaining({
                    repository: 'https://maven.fabricmc.net',
                    groupId: 'net.fabricmc',
                    artifactId: expect.arrayContaining([new PatternPart('literal', 'fabric-loader')]),
                    version: expect.arrayContaining([new PatternPart('wildcard', '')]),
                    versionCaptureTypes: ['wildcard']
                }),
            ])
        }))
        expect(actual.dependencies.map(dep => Array.from(dep.properties.entries()))).toEqual(expect.arrayContaining([
            expect.arrayContaining([
                ['loader_version', expect.objectContaining({ name: 'loader_version', source: 'version' })]
            ]),
        ]))
    })

    it('normal2', async () => {
        const actual = new DependencySettings(`
- repository: https://maven.fabricmc.net
  groupId: net.fabricmc.fabric-api
  artifactId: fabric-api
  version: "\${fabric_version}+\${mcVersion}"
  properties:
    fabric_version:
      source: wildcard
    fabric_minecraft_version:
      source: wildcard
      name: mcVersion
`)
        expect(actual).toEqual(expect.objectContaining({
            dependencies: expect.arrayContaining([
                expect.objectContaining({
                    repository: 'https://maven.fabricmc.net',
                    groupId: 'net.fabricmc.fabric-api',
                    artifactId: expect.arrayContaining([new PatternPart('literal', 'fabric-api')]),
                    version: expect.arrayContaining([
                        new PatternPart('named_wildcard', 'fabric_version'),
                        new PatternPart('literal', '+'),
                        new PatternPart('contextual_wildcard', 'mcVersion')]),
                    versionCaptureTypes: ['named_wildcard']
                }),
            ])
        }))
        expect(actual.dependencies.map(dep => Array.from(dep.properties.entries()))).toEqual(expect.arrayContaining([
            expect.arrayContaining([
                ['fabric_version', expect.objectContaining({ name: 'fabric_version', source: 'wildcard', wildcardName: 'fabric_version' })],
                ['fabric_minecraft_version', expect.objectContaining({ name: 'fabric_minecraft_version', source: 'wildcard', wildcardName: 'mcVersion' })]
            ]),
        ]))
    })

    it('normal3', async () => {
        const actual = new DependencySettings(`
- repository: https://masa.dy.fi/maven
  groupId: fi.dy.masa.malilib
  artifactId: malilib-fabric-\${mcVersion}
  version: "\${malilib_version}"
  properties:
    malilib_minecraft_version:
      source: wildcard
      name: mcVersion
    malilib_version:
      source: wildcard
`)
        expect(actual).toEqual(expect.objectContaining({
            dependencies: expect.arrayContaining([
                expect.objectContaining({
                    repository: 'https://masa.dy.fi/maven',
                    groupId: 'fi.dy.masa.malilib',
                    artifactId: expect.arrayContaining([
                        new PatternPart('literal', 'malilib-fabric-'),
                        new PatternPart('contextual_wildcard', 'mcVersion')]),
                    version: expect.arrayContaining([new PatternPart('named_wildcard', 'malilib_version'),]),
                    versionCaptureTypes: ['named_wildcard']
                }),
            ])
        }))
        expect(actual.dependencies.map(dep => Array.from(dep.properties.entries()))).toEqual(expect.arrayContaining([
            expect.arrayContaining([
                ['malilib_minecraft_version', expect.objectContaining({ name: 'malilib_minecraft_version', source: 'wildcard', wildcardName: 'mcVersion' })],
                ['malilib_version', expect.objectContaining({ name: 'malilib_version', source: 'wildcard', wildcardName: 'malilib_version' })]
            ]),
        ]))
    })
})
