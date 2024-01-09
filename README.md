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
         - [Wildcards](#wildcards)
   * [How to develop and run locally](#how-to-develop-and-run-locally)
   * [Sample workflow](#sample-workflow)
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
- repository: <a string of maven repository>
  groupId: <a string of groupId>
  artifactId: <a tring (pattern) of artifactId>
  version: <s string (pattern) of version>
  properties: <a list telling MC-DepUp what project properties to update>
    - <property name in gradle.properties>: <the source of its value>
```

You also need to have `minecraft_version` in your `gradle.properties`,
so MC-DepUp knows the version of Minecraft that your project depends on.


### Wildcards

There's hardly any versioning convention that all Minecraft modders follow,
that's a sad story for any general dependency manager.

Therefore, MC-DepUp's wildcards can come handy.
You can have them in the pattern of `artifactID` and `version`.

| Wildcard        | Matched Characters                                          |
| --------------- | ----------------------------------------------------------- |
| `*`             | Any number of any characters, equalvalent to RegEx `(.*)`. **Can't be use to match an artifactID**    |
| `${mcMajor}`    | Major version of Minecraft, always `1`                      |
| `${mcMinor}`    | Minor version of Minecraft, it's `20` in `1.20.1`           |
| `${mcPatch}`    | Any non-negative number less than or equal to the patch version of Minecraft |
| `${mcVersion}`  | Any Minecraft version with its patch no greater than the project's Minecraft version |
| `${<any other name>}` | Same effect with `*`. In additon, the matched characters are also used to update project properties with the same name. **Can't be use to match an artifactID**    |

**Additional notes**:

- For example, if a project's Minecraft version is `1.20.4`,
  `${mcVersion}` matches in this order:
  `1.20.4`, `1.20.3`, `1.20.2`, `1.20.1`, `1.20.0`, `1.20`

    - Similarly, `${mc_patch}` matches in this order:
      `4`, `3`, `2`, `1`, `0`.
      It does not match the empty string.

- Although they share similar formats,
  `${mcMajor}, ${mcMinor}, ${mcPatch}, ${mcVersion}`
  are not used to update project properties in the same way as `${<any other name>}`.

    - They hence have names in camelCase to distinguish from your project properties,
      which are usually in snake_case.

**Notes for early-birds**:

- "Variables" used for matching is now renamed and classified as part of "wildcards".
- `${mcVersionFull}` is removed and becomes part of `${mcVersion}`.
- `#` is removed.
- In future versions, wildcards with suffix `minecraft_version` or `mc_version` in their names
  might match in the same way as `${mcVersion}`,
  while they are also used to update properties.


## How to develop and run locally

To develop, run `npm install` to setup,
then run `npm run all` to do all sorts of checks and package all dependencies into `dist/index.js`

If `npm run all` fails use `npm run package` instead.
Usually it should be able to build; I just don't have time to make it pass all checks, especially when I'm not a TypeScript expert.

To run locally, convert all inputs in [action.yml](action.yml) into upper case with the prefix `INPUT_`,
and set those as your environment variables.

For example, this updates the Minecraft version, then the dependencies
``` bash
INPUT_UPDATE_MC_PATCH=true node dist/index.js
```

## Sample workflow

Here is a simple sample workflow that performs the following tasks

1. update `gradle.properties`
2. when any of the dependencies get updated:
    1. build mod using the updated dependencies
    2. make a pull request ([you need to provide a token for this](https://github.com/marketplace/actions/create-pull-request#action-inputs))

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
        with:
          update_mc_patch: true
          update_only_with_mc: false
          tolerable: false

      # #   send file to other jobs using outputs when it is less than 50MB
      # #   so we don't need to repeat 'if' in each step
      # #   you can also use workflow artifacts to achieve the same effect
      # - name: Send Properties
      #   id: send_properties
      #   run: |
      #     properties="$(cat gradle.properties)"
      #     properties_escaped="${properties//$'\n'/\\n}"
      #     properties_escaped="${properties_escaped//$'\r'/\\r}"
      #     echo "properties=$properties_escaped" >> "$GITHUB_OUTPUT"
  
      - name: Setup Java
        if: ${{ steps.depup.outputs.any_update == 'true' }}
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: ${{ env.JAVA_VERSION }}

      - name: Build
        if: ${{ steps.depup.outputs.any_update == 'true' }}
        id: build
        run: |
          chmod +x ./gradlew
          ./gradlew clean build
      
      # see: https://github.com/marketplace/actions/create-pull-request
      - name: Pull Request
        if: ${{ steps.depup.outputs.any_update == 'true' }}
        uses: peter-evans/create-pull-request@v5
        with:
          token: ${{ secrets.PR_BOT_PAT  }}  # replace this with your token
          add-paths: gradle.properties
          commit-message: Update dependencies
          title: Update dependencies
          branch: automated/update-dependencies
```
</details>


## Sample settings

The file containing all your settings should be placed in `.github/modding-dependencies.yml`,
which tells MC-DepUp about the dependencies and corresponding variables in `gradle.properties`.


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
#   version: "${mcVersion}+build.#"
#   variables:
#     - yarn_mappings: version

# Fabric Loader
- repository: https://maven.fabricmc.net
  groupId: net.fabricmc
  artifactId: fabric-loader
  version: "#.#.#"
  variables:
    - loader_version: version

# Fabric API
- repository: https://maven.fabricmc.net
  groupId: net.fabricmc.fabric-api
  artifactId: fabric-api
  version: "#.#.#+${mcVersion}"
  variables:
    - fabric_version: version
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
  version: "${mcMinor}.${mcPatch}.#"
  variables:
    - neo_version: version
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
  version: "${mcVersion}-#.#.#"
  variables:
    - forge_version: version
```
</details>


### malilib (Fabric)
<details>
<summary>click to expand/fold</summary>

``` yaml
# malilib
- repository: https://masa.dy.fi/maven
  groupId: fi.dy.masa.malilib
  artifactId: malilib-fabric-${mcMajor}.${mcMinor}.${mcPatch}
  version: "#.#.#"
  variables:
    - malilib_artifact: artifactId
    - malilib_version: version
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
  version: "#.#.#"
  variables:
    - geckolib_artifact: artifactId
    - geckolib_version: version
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
  version: "9.#.#"
  variables:
    - mod_menu_version: version
```
</details>
