# MC-DepUp

Let's dep-up your mods! It automatically updates the dependencies whenever a new minecraft version is released

---

MC-DepUp (abbr. for Minecraft Dependencies Updater)
updates the `gradle.properties` file according to your settings in `.github/modding-dependencies.yml`

It can work well with Minecraft projects, while Dependabot doesn't -- how can Dependabot handle both Minecraft version and dependency version?

It does not make new builds on its own.
You can use more steps in your actions to make builds.
Possible following steps are build, commit, push and make pull request.

For a list of inputs and outputs, see [action.yml](action.yml)

***MC-DepUp is currently under heavy develop***,
you may build and use it locally using instructions from [How to develop and run locally](#how-to-develop-and-run-locally).

## Table of contents

- [MC-DepUp](#mc-depup)
   * [Table of contents](#table-of-contents)
   * [How it works and how to use it](#how-it-works-and-how-to-use-it)
      + [TL;DR](#tldr)
      + [I stuck on some bug / I want to learn more](#i-stuck-on-some-bug--i-want-to-learn-more)
         - [Variables](#variables)
         - [Wildcards](#wildcards)
         - [Trials and ordering](#trials-and-ordering)
   * [How to develop and run locally](#how-to-develop-and-run-locally)
   * [Sample settings](#sample-settings)
      + [Fabric and Fabric API](#fabric-and-fabric-api)
      + [NeoForge](#neoforge)
      + [Forge](#forge)
      + [malilib (Fabric)](#malilib-fabric)
      + [GeckoLib (Fabric)](#geckolib-fabric)
      + [Mod Menu (Fabric)](#mod-menu-fabric)

## How it works and how to use it


### TL;DR
Go find some examples in [Sample settings](#sample-settings),
you can learn most of it by reading the examples.


### I stuck on some bug / I want to learn more
I assume that you already know a bit about YAML.

Otherwise, [this page](https://learnxinyminutes.com/docs/yaml/) and [this parser](http://www.yaml-online-parser.appspot.com/) should help.
*For beginners, always put strings in double quotes.*

The `modding-dependencies.yml` should contain multiple entries in this format,
so they form a list:

``` yaml
- repository: <string of maven repository>
  groupId: <string of groupId>
  artifactId: <string of artifactId>
  version: <string of version>
  variables: <list of key-value pairs, telling MC-DepUp how to update gradle.properties>
    - <variable name in gradle.properties>: <the type of value it takes, either 'version' or 'artifactId'>
```

You also need to have `minecraft_version` in your `gradle.properties`


#### Variables
Variables are used to make the versions of dependencies match the version of Minecraft.

***Not to be confused with the variables in your `gradle.properties`***

For **both `artifactId` and `version`**, you can use variables.

The variable names are enclosed in `${}`,
and they are expanded into the actual value when matching.
For example, `${mcVersionFull}` can match `1.20.2` when the Minecraft version is `1.20.2`.

Here is a list of variables:

- `mcMajor`: the major version of Minecraft. For Minecraft `1.20.2`, it is `1`
- `mcMinor`: the minor version of Minecraft. For Minecraft `1.20.2`, it is `20`
- `mcPatch`: the patch version of Minecraft. For Minecraft `1.20.2`, it is `2`; for Minecraft `1.20`, it is `0`
- `mcVersion`: the version of Minecraft, omitting patch version when it is 0. That's Mojang's style. For Minecraft `1.20.2`, it is `1.20.2`; for Minecraft `1.20`, it is `1.20`
- `mcVersionFull`: the full version of Minecraft without omitting the patch version. For Minecraft `1.20.2`, it is `1.20.2`; for Minecraft `1.20`, it is `1.20.0`. It's the same as `${mcMajor}.${mcMinor}.${mcPatch}`.


#### Wildcards
There is hardly any versioning convention that all Minecraft modders follow,
so wildcards can come handy.

***Wildcards can only be used for versions.***

Here is a list of wildcards:

- `#`: matches one or more numbers, such as `123` or `0123`, but not `-123` or `12.3`. It matches as many as possible (greedy). It's the same as `(\d+)` in regex.
- `*`: matches zero, one or more of any characters, such as `-alpha.1+build.2` or an empty string. It matches as few as possible (non-greedy). It equals to `(.*?)` in regex.

Note the greediness: when the version `*#` tries to match `alpha12`, the wildcard `#` matches `12`,
because the least that `*` can match while still finishing the entire matching is `alpha`.


#### Trials and ordering
Sometimes, there is no need to update a dependency as often as Minecraft,
especially when only the patch version increases.

For each dependency,
MC-DepUp tries each patch version of Minecraft in decreasing order to expand the [Variables](#variables),
and uses the first match to update `gradle.properties`.

For multiple versions of a dependency that the same Minecraft version can match,
the most recent version is chosen by comparing all numbers matched with `#` from left to right.

For example, for the following list of a dependency's artifactId and versions
1. artifactId: `bar-1.20.2`, version: `1.2.1`
1. artifactId: `bar-1.20.2`, version: `1.1.17`
1. artifactId: `bar-1.20.2`, version: `1.1.16`

With the configuration artifactId: `bar-${mcVersionFull}`, version: `1.#.#`
and Minecraft version `1.20.3`,
MC-DepUp picks the artifactId `bar-1.20.2` and version `1.2.1`.


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

For developers, also see:

- [Versioning](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)
for versioning of GitHub Actions.

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
