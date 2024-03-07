# MC-DepUp

Let's dep-up your mods! It automatically updates Minecraft version and dependencies in your modding project.

---

***MC-DepUp is currently under heavy develop, ANY FEATURE IS SUBJECT TO CHANGE***

MC-DepUp (abbr. for Minecraft Dependencies Updater)
updates the dependencies of your modding project. *(currently limited to `gradle.properties`)*

It works well with Minecraft projects, while other updaters (e.g. Dependabot, Renovate) doesn't -- how can any general updater handle both Minecraft version and dependency version?

It does not make new builds on its own.
You can use more steps in your actions to make builds.
Possible following steps are build, commit, push and make pull request.

For a list of inputs and outputs, see [action.yml](action.yml)

You may also build and use it locally using instructions from [How to develop and run locally](#how-to-develop-and-run-locally).

## Table of contents

- [MC-DepUp](#mc-depup)
   * [Table of contents](#table-of-contents)
   * [How it works and how to use it](#how-it-works-and-how-to-use-it)
      + [TL;DR](#tldr)
      + [I stuck on some bug / I want to learn more](#i-stuck-on-some-bug--i-want-to-learn-more)
      + [Wildcards](#wildcards)
      + [Version ordering](#version-ordering)
   * [How to develop and run locally](#how-to-develop-and-run-locally)
   * [Sample workflows](#sample-workflows)
   * [Sample settings](#sample-settings)
      + [Fabric and Fabric API](#fabric-and-fabric-api)
      + [NeoForge](#neoforge)
      + [Forge](#forge)
      + [malilib (Fabric)](#malilib-fabric)
      + [GeckoLib (Fabric)](#geckolib-fabric)
      + [Mod Menu (Fabric)](#mod-menu-fabric)

## How it works and how to use it


### TL;DR
Go find some examples in [Sample workflow](#sample-workflow) and [Sample settings](#sample-settings),
you can learn most of it by reading the examples.


### I stuck on some bug / I want to learn more
I assume that you already know a bit about YAML.

Otherwise, [this page](https://learnxinyminutes.com/docs/yaml/) and [this parser](http://www.yaml-online-parser.appspot.com/) should help.
*For beginners, always put strings in quotes.*

The `modding-dependencies.yml` should contain multiple entries in this format,
so they form a list:

``` yaml
- repository: "<maven repository>"
  groupId: "<groupId>"
  artifactId: "<pattern of artifactId>"
  version: "<pattern of version>"
  properties: <a map telling MC-DepUp what project properties to update>
    "<property name in gradle.properties>":
      source: "<the source of its value>"
```

You also need to have `minecraft_version` in your `gradle.properties`,
so MC-DepUp knows the version of Minecraft that your project depends on.

The source of value for any property could be one of these:

- `artifactId`/`version`: the entire matched artifactId/version string
- `wildcard`: the wildcard with the same name as the wildcard in the bracket


### Wildcards

There's hardly any versioning convention that all Minecraft modders follow,
that's a sad story for any general dependency manager.

Therefore, MC-DepUp's wildcards can come handy.
You can have them in the pattern of `artifactId` and `version`.

| Wildcard        | Matched Characters                                          |
| --------------- | ----------------------------------------------------------- |
| `*`             | Any number of any characters, same as the RegEx `(.*)`. **Can't be used to match an artifactId**    |
| `${mcMajor}`    | Major version of Minecraft; it's always `1`                 |
| `${mcMinor}`    | Minor version of Minecraft; it's `20` for Minecraft `1.20.1`|
| `${mcPatch}`    | Any non-negative number less than or equal to the patch version of Minecraft |
| `${mcVersion}`  | Any version with the same major and minor versions, while the patch version is no greater than the Minecraft patch version; the patch version can be omitted |
| `${<any other name>}` | Same effect with `*`. **Can't be used to match an artifactId**    |

**Additional notes**:

- For example, if a project's Minecraft version is `1.20.2`,
  `${mcVersion}` matches any of those:
  `1.20.2`, `1.20.1`, `1.20.0`, `1.20`

    - Similarly, `${mcPatch}` matches any of `2`, `1`, `0`,
      except the empty string.

- `${mcMajor}, ${mcMinor}, ${mcPatch}, ${mcVersion}`
  have names in camelCase to distinguish from other named wildcards,
  which are usually in snake_case,
  as they have different rules of matching


**Notes for early-birds**:

- The word "variables" is too widely used,
  so this key in `modding-dependencies.yml` is renamed to "dependencies"
  - Its structure is also overhauled.
- Similarly, what were previously called "variables" in matching now become a subset of "wildcards".
- `${mcVersionFull}` is removed, and its functionality is merged to `${mcVersion}`.
- `#` is removed as it is not flexible to the omission of patch version.
- `*` now performs greedy matching.


### Version ordering

To determining the newest version,
all matching versions are firstly filtered by the parts matched by `${mcVersion}` or `${mcPatch}`,
and the ones with the highest Minecraft version is kept. Note that the ones with the patch versions are considered newer than the ones without.

Then, the parts matched by `*` are compared from left to right following [Gradle's version ordering rules](https://docs.gradle.org/current/userguide/single_versions.html)

For example, these versions are ordered from the newest to the oldest,
when the version pattern is `*-mc${mcVersion}*` and Minecraft version is `1.20.2`

- `1.0.1-mc1.20.2` (effectively `1.0.1`)
- `1.0.0-mc1.20.2` (effectively `1.0.0`)
- `1.0-mc1.20.2` (effectively `1.0`)
- `1.0-mc1.20.2-alpha` (effectively `1.0-alpha`)


## How to develop and run locally

To develop, setup with `npm install`,
and then `npm run all` to do all sorts of checks and packaging.
The packaged JavaScript is at `dist/index.js`

If `npm run all` fails use `npm run package` instead.
Usually it should be able to build; I just don't have time to make it pass all checks, especially when I'm not a TypeScript expert.

To run locally, convert all inputs in [action.yml](action.yml) into upper case with the prefix `INPUT_`,
and set those as your shell environment variables.

For example, this updates the Minecraft version, then the dependencies
``` bash
INPUT_UPDATE_MC_PATCH=true node dist/index.js
```

## Sample workflows

Here is a minimal sample workflow that performs the following tasks

1. Update `gradle.properties`
2. When any of the dependencies get updated, it makes a pull request with the latest dependencies ([you need to provide a token for this](https://github.com/marketplace/actions/create-pull-request#action-inputs))

Copy and modify it (be sure to read the comments) to use in your repository.

<details>
<summary>click to expand/fold</summary>

``` yaml
name: Update Dependencies
on:
  schedule:
    - cron: '12 14 * * 5'  # minute and hour are randomized to avoid peak hours
  workflow_dispatch:  # enables manual running of this workflow

env:
  JAVA_VERSION: 17 # must be the same as the version used in build.gradle

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Update Dependencies
        id: depup
        uses: LucunJi/mc-depup@v0.0.1
  
      # see: https://github.com/marketplace/actions/create-pull-request
      - name: Pull Request
        if: ${{ steps.depup.outputs.any_update == 'true' }}
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.PR_BOT_PAT  }}  # replace this with your token
          add-paths: gradle.properties
          commit-message: Update dependencies
          title: Update dependencies
          body: ${{ steps.depup.outputs.summary }}
          branch: automated/update-dependencies
```
</details>


## Sample settings

The file containing all your settings should be placed in `.github/modding-dependencies.yml`,
which tells MC-DepUp about the dependencies and corresponding properties in `gradle.properties`.


### Fabric and Fabric API
<details>
<summary>click to expand/fold</summary>

The part about yarn mapping is commented out because there is need to
[migrate mapping](https://fabricmc.net/wiki/tutorial:migratemappings).
You can uncomment it after adding additional steps in to handle that.


``` yaml
# Yarn Mapping
# - repository: https://maven.fabricmc.net
#   groupId: net.fabricmc
#   artifactId: yarn
#   version: "${mcVersion}+*"
#   properties:
#     yarn_mappings:
#       source: version

# Fabric Loader
- repository: https://maven.fabricmc.net
  groupId: net.fabricmc
  artifactId: fabric-loader
  version: "*"
  properties:
    loader_version:
      source: version

# Fabric API
- repository: https://maven.fabricmc.net
  groupId: net.fabricmc.fabric-api
  artifactId: fabric-api
  version: "*+${mcVersion}"
  properties:
    fabric_version:
      source: version
```
</details>


### NeoForge
<details>
<summary>click to expand/fold</summary>

``` yaml
# NeoForge
- repository: https://maven.neoforged.net/releases
  groupId: net.neoforged
  artifactId: neoforge
  version: "${mcMinor}.${mcPatch}.*"
  properties:
    neo_version:
      source: version
```
</details>


### Forge
<details>
<summary>click to expand/fold</summary>

``` yaml
# Forge
- repository: https://maven.minecraftforge.net/
  groupId: net.minecraftforge
  artifactId: forge
  version: "${mcVersion}-*"
  properties:
    forge_version:
      source: version
```
</details>


### malilib (Fabric)
<details>
<summary>click to expand/fold</summary>

``` yaml
# malilib
- repository: https://masa.dy.fi/maven
  groupId: fi.dy.masa.malilib
  artifactId: "malilib-fabric-${mcVersion}"
  version: "*"
  properties:
    malilib_minecraft_version:
      source: wildcard
      name: mcVersion
    malilib_version:
      source: version
```
</details>


### GeckoLib (Fabric)
<details>
<summary>click to expand/fold</summary>

``` yaml
# GeckoLib (Fabric)
- repository: https://dl.cloudsmith.io/public/geckolib3/geckolib/maven/
  groupId: software.bernie.geckolib
  artifactId: geckolib-fabric-${mcVersion}
  version: "*"
  properties:
    geckolib_minecraft_version:
      source: wildcard
      name: mcVersion
    geckolib_version:
      source: version
```
</details>


### Mod Menu (Fabric)
<details>
<summary>click to expand/fold</summary>
Mod Menu does not include the version of Minecraft in artifactId or version,
so you may need to change the pattern of version.

``` yaml
# Mod Menu
- repository: https://api.modrinth.com/maven
  groupId: maven.modrinth
  artifactId: modmenu
  # change this according to your need
  version: "9.*"
  properties:
    mod_menu_version:
      source: version
```
</details>
