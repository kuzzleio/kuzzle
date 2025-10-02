## [2.48.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.47.0...v2.48.0-beta.1) (2025-10-02)


### Features

* kuzzle is compatible with redis-8 7 6 and 5 ([87e283e](https://github.com/kuzzleio/kuzzle/commit/87e283e913e526c96998243fdd6d57ef4a4715ad))
* **logger:** create logger child instances for plugins  ([#2621](https://github.com/kuzzleio/kuzzle/issues/2621)) ([05a8e57](https://github.com/kuzzleio/kuzzle/commit/05a8e57b96c94e638820ea3654e5c668c6c7cd28))
* update secrets usage in ci ([b6c5fe7](https://github.com/kuzzleio/kuzzle/commit/b6c5fe72fa606a4eda1841515b16171a2c645120))


### Bug Fixes

* **elasticsearch:** do not allow user to provide _kuzzle_info for M operations ([#2607](https://github.com/kuzzleio/kuzzle/issues/2607)) ([b6adb34](https://github.com/kuzzleio/kuzzle/commit/b6adb3461a213afddcc6f7c2fc92252c5204fc12))
* revert uuid upgrade, because of ESM compat ([dbe582a](https://github.com/kuzzleio/kuzzle/commit/dbe582a241fe9d85b21c856a47a26f2d9dd6c498))

## [2.47.0](https://github.com/kuzzleio/kuzzle/compare/v2.46.0...v2.47.0) (2025-09-16)


### Features

* be able to use `propsToLabels` option when using loki logger preset ([#2619](https://github.com/kuzzleio/kuzzle/issues/2619)) ([0da8fbf](https://github.com/kuzzleio/kuzzle/commit/0da8fbf4d6d0fd4872ef1a142e2b94abc0d86c22))

## [2.46.0](https://github.com/kuzzleio/kuzzle/compare/v2.45.0...v2.46.0) (2025-09-10)


### Features

* **log:** allow Kuzzle application devs to use the logger before the application startup ([#2617](https://github.com/kuzzleio/kuzzle/issues/2617)) ([9067241](https://github.com/kuzzleio/kuzzle/commit/906724108d503c4a2e9b19351b6e3937910329ec))

## [2.45.0](https://github.com/kuzzleio/kuzzle/compare/v2.44.0...v2.45.0) (2025-08-25)


### Features

* **funnel:** trigger success/error events with trigger events ([2fc501f](https://github.com/kuzzleio/kuzzle/commit/2fc501f716499a208483b8a44791fd518f8d48df))
* update to redis:7 ([f8ee151](https://github.com/kuzzleio/kuzzle/commit/f8ee151f14c6c47a41c024fa79d70c891c765969))
* use the Kuzzle logger on the Application ([#2616](https://github.com/kuzzleio/kuzzle/issues/2616)) ([d30652e](https://github.com/kuzzleio/kuzzle/commit/d30652e89d4cb789ca5dff5d51b49c604c5c20d1))


### Bug Fixes

* **funnel:** handle errors for trigger events same way as base requests ([8bc9ca2](https://github.com/kuzzleio/kuzzle/commit/8bc9ca283969b6c104bc3709a4e5e838117273f2))

## [2.44.0](https://github.com/kuzzleio/kuzzle/compare/v2.43.2...v2.44.0) (2025-07-24)


### Features

* **kuzzle.mock:** add child logger stub to KuzzleMock class ([8300582](https://github.com/kuzzleio/kuzzle/commit/83005825d3721dbd3c5f1ed368142a09e4da6906))
* **kuzzle.mock:** enhance child logger stub with additional log levels ([d30063f](https://github.com/kuzzleio/kuzzle/commit/d30063faba2c4cc65a1aec2c39595ea79d2e969a))
* qol around docker compose ([70eba27](https://github.com/kuzzleio/kuzzle/commit/70eba27b35e99c6942a35672eddc01102cb649c8))
* **token-manager:** enhance logging for token management operations ([f27b702](https://github.com/kuzzleio/kuzzle/commit/f27b70279acc5baabd72563ab722851b55e2cf7f))
* **token-manager:** first attempt at fixing concurrency ([6e8760c](https://github.com/kuzzleio/kuzzle/commit/6e8760c1c4bb8651af70eaf36a1635963d80b795))


### Bug Fixes

* **kuzzle.mock:** correct child logger stub implementation to return an object ([8dac44b](https://github.com/kuzzleio/kuzzle/commit/8dac44b3af5786b858aff5b7b945a1247d825cef))
* **logger:** namespace property prefix ([deddf2c](https://github.com/kuzzleio/kuzzle/commit/deddf2c70902d3891dd12d785ccc2768a96aca6d))

## [2.44.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.43.2...v2.44.0-beta.1) (2025-07-24)


### Features

* **kuzzle.mock:** add child logger stub to KuzzleMock class ([8300582](https://github.com/kuzzleio/kuzzle/commit/83005825d3721dbd3c5f1ed368142a09e4da6906))
* **kuzzle.mock:** enhance child logger stub with additional log levels ([d30063f](https://github.com/kuzzleio/kuzzle/commit/d30063faba2c4cc65a1aec2c39595ea79d2e969a))
* qol around docker compose ([70eba27](https://github.com/kuzzleio/kuzzle/commit/70eba27b35e99c6942a35672eddc01102cb649c8))
* **token-manager:** enhance logging for token management operations ([f27b702](https://github.com/kuzzleio/kuzzle/commit/f27b70279acc5baabd72563ab722851b55e2cf7f))
* **token-manager:** first attempt at fixing concurrency ([6e8760c](https://github.com/kuzzleio/kuzzle/commit/6e8760c1c4bb8651af70eaf36a1635963d80b795))


### Bug Fixes

* **kuzzle.mock:** correct child logger stub implementation to return an object ([8dac44b](https://github.com/kuzzleio/kuzzle/commit/8dac44b3af5786b858aff5b7b945a1247d825cef))
* **logger:** namespace property prefix ([deddf2c](https://github.com/kuzzleio/kuzzle/commit/deddf2c70902d3891dd12d785ccc2768a96aca6d))

## [2.43.2](https://github.com/kuzzleio/kuzzle/compare/v2.43.1...v2.43.2) (2025-06-10)


### Bug Fixes

* **hotelClerk:** error logging context in unsubscribe method ([ce85842](https://github.com/kuzzleio/kuzzle/commit/ce85842aeb1bf703c974e1b10085a089a684990d))

## [2.43.2-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.43.1...v2.43.2-beta.1) (2025-06-10)


### Bug Fixes

* **hotelClerk:** error logging context in unsubscribe method ([ce85842](https://github.com/kuzzleio/kuzzle/commit/ce85842aeb1bf703c974e1b10085a089a684990d))

## [2.43.1](https://github.com/kuzzleio/kuzzle/compare/v2.43.0...v2.43.1) (2025-04-08)


### Bug Fixes

* pino in depedencies instead of DevDeps ([91f193a](https://github.com/kuzzleio/kuzzle/commit/91f193a8358169bca59815d61342665d960a155a))

## [2.43.0](https://github.com/kuzzleio/kuzzle/compare/v2.42.0...v2.43.0) (2025-04-07)


### Features

* **core-plugins:** remove kuzzle-plugin-logger from core plugins and mark its config as deprecated ([4c14811](https://github.com/kuzzleio/kuzzle/commit/4c14811a3f3f6d92a43796db211cf61759ceb961))
* **internallogger:** add function to change log level at runtime ([31f7622](https://github.com/kuzzleio/kuzzle/commit/31f7622cd2dfe41cac2541774ff6e80ededbd3da))
* **logger:** allow setting initial level from config ([da7ba47](https://github.com/kuzzleio/kuzzle/commit/da7ba47857894aabff7ddab6b067d871ec7b8390))
* **logger:** flush logs on app shutdown ([9108da4](https://github.com/kuzzleio/kuzzle/commit/9108da47743e5954d7d15af8c6c39599498b00b3))
* **logger:** implement logger ([57159f4](https://github.com/kuzzleio/kuzzle/commit/57159f46496610ff79383f4313fc2ccb5d603e5e))


### Bug Fixes

* Add sudo command for apt install ([002811b](https://github.com/kuzzleio/kuzzle/commit/002811b8232272ddf1437f03d04556f40d42e6b9))
* **config:** fix config breaking change ([8e0eb04](https://github.com/kuzzleio/kuzzle/commit/8e0eb0466efd91b07183eb2a8dcea4eb617bd622))
* **elasticsearch:** allow bulk updateByQuery without changes ([8b5df0b](https://github.com/kuzzleio/kuzzle/commit/8b5df0b3d00209dd10d27da19df114b04113e3fb))
* Fix CI missing update when installing libuwind ([967d89c](https://github.com/kuzzleio/kuzzle/commit/967d89c296d90987148b78c8fd0b7b632e616f0e))
* **logger:** pass config in constructor instead of accessing it through global ([ab92b9c](https://github.com/kuzzleio/kuzzle/commit/ab92b9c68e39263de94d16b337df21acaa6bcdc7))

## [2.43.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.42.0...v2.43.0-beta.1) (2025-04-07)


### Features

* **core-plugins:** remove kuzzle-plugin-logger from core plugins and mark its config as deprecated ([4c14811](https://github.com/kuzzleio/kuzzle/commit/4c14811a3f3f6d92a43796db211cf61759ceb961))
* **internallogger:** add function to change log level at runtime ([31f7622](https://github.com/kuzzleio/kuzzle/commit/31f7622cd2dfe41cac2541774ff6e80ededbd3da))
* **logger:** allow setting initial level from config ([da7ba47](https://github.com/kuzzleio/kuzzle/commit/da7ba47857894aabff7ddab6b067d871ec7b8390))
* **logger:** flush logs on app shutdown ([9108da4](https://github.com/kuzzleio/kuzzle/commit/9108da47743e5954d7d15af8c6c39599498b00b3))
* **logger:** implement logger ([57159f4](https://github.com/kuzzleio/kuzzle/commit/57159f46496610ff79383f4313fc2ccb5d603e5e))


### Bug Fixes

* Add sudo command for apt install ([002811b](https://github.com/kuzzleio/kuzzle/commit/002811b8232272ddf1437f03d04556f40d42e6b9))
* **config:** fix config breaking change ([8e0eb04](https://github.com/kuzzleio/kuzzle/commit/8e0eb0466efd91b07183eb2a8dcea4eb617bd622))
* **elasticsearch:** allow bulk updateByQuery without changes ([8b5df0b](https://github.com/kuzzleio/kuzzle/commit/8b5df0b3d00209dd10d27da19df114b04113e3fb))
* Fix CI missing update when installing libuwind ([967d89c](https://github.com/kuzzleio/kuzzle/commit/967d89c296d90987148b78c8fd0b7b632e616f0e))
* **logger:** pass config in constructor instead of accessing it through global ([ab92b9c](https://github.com/kuzzleio/kuzzle/commit/ab92b9c68e39263de94d16b337df21acaa6bcdc7))

## [2.42.0](https://github.com/kuzzleio/kuzzle/compare/v2.41.0...v2.42.0) (2025-03-11)


### Features

* bump deps ([3c59605](https://github.com/kuzzleio/kuzzle/commit/3c596057ea01e4f0081856de0aa7529753e5c94b))

## [2.42.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.41.0...v2.42.0-beta.1) (2025-03-11)


### Features

* bump deps ([3c59605](https://github.com/kuzzleio/kuzzle/commit/3c596057ea01e4f0081856de0aa7529753e5c94b))

## [2.41.0](https://github.com/kuzzleio/kuzzle/compare/v2.40.1...v2.41.0) (2025-03-05)


### Features

* add a new unauthenticated `/_ready` HTTP endpoint ([#2592](https://github.com/kuzzleio/kuzzle/issues/2592)) ([52d54fa](https://github.com/kuzzleio/kuzzle/commit/52d54fa9ce10ec50fab46f9ca44dc01e46893e64))
* collection getSettings ([#2588](https://github.com/kuzzleio/kuzzle/issues/2588)) ([da75cbc](https://github.com/kuzzleio/kuzzle/commit/da75cbc011adb6abd6a6db295f7355d9dc088e85))


### Bug Fixes

* add a getter for started property and a setter, create _started private property ([aacee11](https://github.com/kuzzleio/kuzzle/commit/aacee11ce3598a324ebc774bb624614ed50314bf))
* update es version to avoid anyController error ([6d594dd](https://github.com/kuzzleio/kuzzle/commit/6d594ddb9a454b404af4c5c8f85d264c9029ba59))

## [2.40.1](https://github.com/kuzzleio/kuzzle/compare/v2.40.0...v2.40.1) (2025-02-11)


### Bug Fixes

* arm architecture not needed ([dd751a9](https://github.com/kuzzleio/kuzzle/commit/dd751a990be3211f71490b31de285f25dd3600ff))

## [2.40.1-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.40.0...v2.40.1-beta.1) (2025-02-11)


### Bug Fixes

* arm architecture not needed ([dd751a9](https://github.com/kuzzleio/kuzzle/commit/dd751a990be3211f71490b31de285f25dd3600ff))

# [2.40.0](https://github.com/kuzzleio/kuzzle/compare/v2.39.0...v2.40.0) (2025-01-16)


### Features

* **elasticsearch:** add post_filter to whitelist of body terms for ES 7 and 8 ([99344c6](https://github.com/kuzzleio/kuzzle/commit/99344c6f8e161d7c428e7bb9195c263dd15ac645))

# [2.39.0](https://github.com/kuzzleio/kuzzle/compare/v2.38.1...v2.39.0) (2025-01-15)


### Features

* update deps ([1477510](https://github.com/kuzzleio/kuzzle/commit/14775108247661f70ef538ae27f1aea5fe2659c1))

# [2.39.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.38.1...v2.39.0-beta.1) (2025-01-15)


### Features

* update deps ([1477510](https://github.com/kuzzleio/kuzzle/commit/14775108247661f70ef538ae27f1aea5fe2659c1))

## [2.38.1](https://github.com/kuzzleio/kuzzle/compare/v2.38.0...v2.38.1) (2025-01-13)


### Bug Fixes

* **plugin:** fix allowAdditionalActionProperties config accessing ([5fc8096](https://github.com/kuzzleio/kuzzle/commit/5fc80968c62a5bca675e154dfb1e22d43493f09c))

# [2.38.0](https://github.com/kuzzleio/kuzzle/compare/v2.37.1...v2.38.0) (2025-01-09)


### Features

* **funnel:** add request:onExecution pipe ([8711746](https://github.com/kuzzleio/kuzzle/commit/87117468bc6e9d33072a3875416f80bb34c39ec6))

# [2.38.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.37.1...v2.38.0-beta.1) (2025-01-09)


### Features

* **funnel:** add request:onExecution pipe ([8711746](https://github.com/kuzzleio/kuzzle/commit/87117468bc6e9d33072a3875416f80bb34c39ec6))

## [2.37.1](https://github.com/kuzzleio/kuzzle/compare/v2.37.0...v2.37.1) (2025-01-08)


### Bug Fixes

* reverting zeromq to 6.0.0-beta.6, need futher investigation ([0ec5a73](https://github.com/kuzzleio/kuzzle/commit/0ec5a73b8943d8022d318864f2413988cbab04d8))
* update package-lock.json ([e80b6ab](https://github.com/kuzzleio/kuzzle/commit/e80b6aba6e55583b760edfff7f374688afe7aec2))

# [2.37.0](https://github.com/kuzzleio/kuzzle/compare/v2.36.0...v2.37.0) (2025-01-08)


### Bug Fixes

* Add COPY instead of ADD in dockerfile ([24e5be6](https://github.com/kuzzleio/kuzzle/commit/24e5be6059ecbdcd072dcc8c5d091253896a3656))
* Add version check in docker images ([32a2efd](https://github.com/kuzzleio/kuzzle/commit/32a2efd896d4f5cf3d010cc7710ca8d523389ef3))
* cookie import ([f582a9f](https://github.com/kuzzleio/kuzzle/commit/f582a9fbb97b2231399bbf84dfa7123937283e42))
* fixing tests with aedes upgrade ([212e98e](https://github.com/kuzzleio/kuzzle/commit/212e98ef7f5ec26946d984564151ed4b0ca9cb92))
* tsconfig.json ([328a04d](https://github.com/kuzzleio/kuzzle/commit/328a04d22ee6cb0310b5194e14afe1d8354361b3))


### Features

* update deps ([563a6ba](https://github.com/kuzzleio/kuzzle/commit/563a6ba5507c3cdc90e31065c2f4c6a2c5086bd9))

# [2.37.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.36.0...v2.37.0-beta.1) (2025-01-08)


### Bug Fixes

* Add COPY instead of ADD in dockerfile ([24e5be6](https://github.com/kuzzleio/kuzzle/commit/24e5be6059ecbdcd072dcc8c5d091253896a3656))
* Add version check in docker images ([32a2efd](https://github.com/kuzzleio/kuzzle/commit/32a2efd896d4f5cf3d010cc7710ca8d523389ef3))
* cookie import ([f582a9f](https://github.com/kuzzleio/kuzzle/commit/f582a9fbb97b2231399bbf84dfa7123937283e42))
* fixing tests with aedes upgrade ([212e98e](https://github.com/kuzzleio/kuzzle/commit/212e98ef7f5ec26946d984564151ed4b0ca9cb92))
* tsconfig.json ([328a04d](https://github.com/kuzzleio/kuzzle/commit/328a04d22ee6cb0310b5194e14afe1d8354361b3))


### Features

* update deps ([563a6ba](https://github.com/kuzzleio/kuzzle/commit/563a6ba5507c3cdc90e31065c2f4c6a2c5086bd9))

# [2.36.0](https://github.com/kuzzleio/kuzzle/compare/v2.35.3...v2.36.0) (2025-01-08)


### Bug Fixes

* issue with tests and array sorting ([345563e](https://github.com/kuzzleio/kuzzle/commit/345563eff3b1a08d4c8401a21dbb443297982459))


### Features

* **controllers:** add a config to allow additional properties in actions definitions ([8c3eabe](https://github.com/kuzzleio/kuzzle/commit/8c3eabe5cd5b8d438a33c8b5e36d18243560599e))
* remove murmurhash native in favor of murmurhashJS ([453f8e4](https://github.com/kuzzleio/kuzzle/commit/453f8e412e3526da1bed88663dceb68d24db3c08))

## [2.35.3](https://github.com/kuzzleio/kuzzle/compare/v2.35.2...v2.35.3) (2024-12-31)


### Bug Fixes

* remove if statement that was blocking release ([486ad1a](https://github.com/kuzzleio/kuzzle/commit/486ad1a0863d1258d89b8f85d5421126124dd137))

## [2.35.2](https://github.com/kuzzleio/kuzzle/compare/v2.35.1...v2.35.2) (2024-12-31)


### Bug Fixes

* Remove needs statement in action ([2dec872](https://github.com/kuzzleio/kuzzle/commit/2dec8724b994685fe38a6b6d5fc11821fe897939))

## [2.35.1](https://github.com/kuzzleio/kuzzle/compare/v2.35.0...v2.35.1) (2024-12-31)


### Bug Fixes

* process was releasing beta version of images ([9b541f9](https://github.com/kuzzleio/kuzzle/commit/9b541f94879d29e298b730c2371e05eeb98d6015))

## [2.35.1-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.35.0...v2.35.1-beta.1) (2024-12-31)


### Bug Fixes

* process was releasing beta version of images ([9b541f9](https://github.com/kuzzleio/kuzzle/commit/9b541f94879d29e298b730c2371e05eeb98d6015))

# [2.35.0](https://github.com/kuzzleio/kuzzle/compare/v2.34.0...v2.35.0) (2024-12-19)


### Bug Fixes

* add node_version env var in workflow ([05ff115](https://github.com/kuzzleio/kuzzle/commit/05ff1155b109b86b39a5e254742ab200beba3a80))
* ci was not running properly ([699f180](https://github.com/kuzzleio/kuzzle/commit/699f180006fb4e061273428fcb8f375f8f1ba720))
* deployment workflow run rework ([db0501e](https://github.com/kuzzleio/kuzzle/commit/db0501e4581b773d1ca5e53bb4d6b118974b4451))
* elasticsearch docker_platforms ([b91edfe](https://github.com/kuzzleio/kuzzle/commit/b91edfed7c2ddd54b4de4f36ac3e117cf83054fa))
* only deploy on master branch ([c481243](https://github.com/kuzzleio/kuzzle/commit/c4812438bebd61147a37300680908414e9d4e10d))
* typo in workflow ([e565d7d](https://github.com/kuzzleio/kuzzle/commit/e565d7dbadbe5fad4e7bc98e4615525d56fc6ed4))
* ubuntu version and deps issues ([8ef4738](https://github.com/kuzzleio/kuzzle/commit/8ef4738389833e6caf7406e33e108f70105724df))


### Features

* **protocols:** add logging socket closing ([5da5930](https://github.com/kuzzleio/kuzzle/commit/5da5930af18d447d82dd4c4f7c2810257479fec2))

# [2.35.0-beta.4](https://github.com/kuzzleio/kuzzle/compare/v2.35.0-beta.3...v2.35.0-beta.4) (2024-12-19)


### Bug Fixes

* only deploy on master branch ([c481243](https://github.com/kuzzleio/kuzzle/commit/c4812438bebd61147a37300680908414e9d4e10d))

# [2.35.0-beta.3](https://github.com/kuzzleio/kuzzle/compare/v2.35.0-beta.2...v2.35.0-beta.3) (2024-12-19)


### Bug Fixes

* elasticsearch docker_platforms ([b91edfe](https://github.com/kuzzleio/kuzzle/commit/b91edfed7c2ddd54b4de4f36ac3e117cf83054fa))

# [2.35.0-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.35.0-beta.1...v2.35.0-beta.2) (2024-12-19)


### Bug Fixes

* add node_version env var in workflow ([05ff115](https://github.com/kuzzleio/kuzzle/commit/05ff1155b109b86b39a5e254742ab200beba3a80))

# [2.35.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.34.0...v2.35.0-beta.1) (2024-12-19)


### Bug Fixes

* ci was not running properly ([699f180](https://github.com/kuzzleio/kuzzle/commit/699f180006fb4e061273428fcb8f375f8f1ba720))
* deployment workflow run rework ([db0501e](https://github.com/kuzzleio/kuzzle/commit/db0501e4581b773d1ca5e53bb4d6b118974b4451))
* typo in workflow ([e565d7d](https://github.com/kuzzleio/kuzzle/commit/e565d7dbadbe5fad4e7bc98e4615525d56fc6ed4))
* ubuntu version and deps issues ([8ef4738](https://github.com/kuzzleio/kuzzle/commit/8ef4738389833e6caf7406e33e108f70105724df))


### Features

* **protocols:** add logging socket closing ([5da5930](https://github.com/kuzzleio/kuzzle/commit/5da5930af18d447d82dd4c4f7c2810257479fec2))

# [2.34.0](https://github.com/kuzzleio/kuzzle/compare/v2.33.1...v2.34.0) (2024-11-07)


### Bug Fixes

* do not store api keys in internal index, use fingerprint instead ([c9cb2b8](https://github.com/kuzzleio/kuzzle/commit/c9cb2b869a1e94ff19a8812415985290d7efb95f))
* remove un wanted breaking change ([a351f96](https://github.com/kuzzleio/kuzzle/commit/a351f968383e9a9d7cd28970332f514b7f08272a))
* target right ecma version in  eslint ([a96e7e1](https://github.com/kuzzleio/kuzzle/commit/a96e7e1434c2e765bf40cc6535d99b9381c28eb7))


### Features

* remove seed from internal storage if we have it from config ([2467201](https://github.com/kuzzleio/kuzzle/commit/24672019074a30384bcfa7cdc6af148e39338ef3))

# [2.34.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.33.1...v2.34.0-beta.1) (2024-11-07)


### Bug Fixes

* do not store api keys in internal index, use fingerprint instead ([c9cb2b8](https://github.com/kuzzleio/kuzzle/commit/c9cb2b869a1e94ff19a8812415985290d7efb95f))
* remove un wanted breaking change ([a351f96](https://github.com/kuzzleio/kuzzle/commit/a351f968383e9a9d7cd28970332f514b7f08272a))
* target right ecma version in  eslint ([a96e7e1](https://github.com/kuzzleio/kuzzle/commit/a96e7e1434c2e765bf40cc6535d99b9381c28eb7))


### Features

* remove seed from internal storage if we have it from config ([2467201](https://github.com/kuzzleio/kuzzle/commit/24672019074a30384bcfa7cdc6af148e39338ef3))

## [2.33.1](https://github.com/kuzzleio/kuzzle/compare/v2.33.0...v2.33.1) (2024-10-29)


### Bug Fixes

* **npm:** fix ES7 sdk pulled from Github instead of NPM ([33098dd](https://github.com/kuzzleio/kuzzle/commit/33098ddce1e574bc622109a1d9a56aa996615a59))

# [2.33.0](https://github.com/kuzzleio/kuzzle/compare/v2.32.0...v2.33.0) (2024-10-04)


### Bug Fixes

* improve typing to avoid typescript build errors ([569bf2c](https://github.com/kuzzleio/kuzzle/commit/569bf2c680e70c47cb5b8f81a326f4039e8a5214))


### Features

* **elasticsearch:** add flag to reindex collection after an update ([3cbc2b5](https://github.com/kuzzleio/kuzzle/commit/3cbc2b55e3ff1eb7ddd9c682fd34c87e18c86cbb))

# [2.32.0](https://github.com/kuzzleio/kuzzle/compare/v2.31.0...v2.32.0) (2024-10-02)


### Bug Fixes

* bump deps to remove vulnerabilities ([ef27719](https://github.com/kuzzleio/kuzzle/commit/ef277194e0ed355ca0a5c16c9131875094f3a0b8))
* **ci:** indent to pass linter ([f849e2c](https://github.com/kuzzleio/kuzzle/commit/f849e2c9d2aff5a3636a0b2fc0d11ac86561277a))
* **conflicts:** merge conflict ([e763392](https://github.com/kuzzleio/kuzzle/commit/e76339261029262aac31af972dc81f05a082e469))
* **es8:** add elasticsearch-8 in listened branches ([e59cedd](https://github.com/kuzzleio/kuzzle/commit/e59cedd2a2404e315024f18eb3823af03e341411))
* **es8:** update deployment to allow elasticsearch-8 package to be deployed as a pre-release ([8286522](https://github.com/kuzzleio/kuzzle/commit/8286522368ee70efd54a6d631a5917f02d96b952))
* **kuzzleeventemitter:** add missing generics parameters ([48cbcf2](https://github.com/kuzzleio/kuzzle/commit/48cbcf2e2713e96a1e5e21ba6bf23452669edaad))
* **storage:** update more types ([50bfe58](https://github.com/kuzzleio/kuzzle/commit/50bfe580db9e86d6e1de761605ac86debdae2e48))
* **tests:** fixing unit tests ([50f2cac](https://github.com/kuzzleio/kuzzle/commit/50f2cac418f1616ec1c9c68ef149f8072a7a45e4))
* **triggerEvents:** fix response format for request with triggerEvents ([#2546](https://github.com/kuzzleio/kuzzle/issues/2546)) ([ffed901](https://github.com/kuzzleio/kuzzle/commit/ffed901d6051d6c0558019d1b67d30fdec3093ff))


### Features

* **dockerfiles:** move images from bullseye to bookworm ([#2545](https://github.com/kuzzleio/kuzzle/issues/2545)) ([c225aa1](https://github.com/kuzzleio/kuzzle/commit/c225aa183267fcdbd842e37fce1e4091780e7b1d))
* **elasticsearch8:** tests unit are now okay ([1f4d1e8](https://github.com/kuzzleio/kuzzle/commit/1f4d1e8686c3f460496f8a73d983371a173d3a14))
* **es8:** elasticsearch 8 unit tests & functional tests running ([bdcce96](https://github.com/kuzzleio/kuzzle/commit/bdcce96fc97ff58143f29484ae1da2076ee2e885))
* **es8:** support both es7 and es8 ([e12c35a](https://github.com/kuzzleio/kuzzle/commit/e12c35af6b3a8d375005177cdf56509396db5cb4))
* only support ES 8.x ([4a8038e](https://github.com/kuzzleio/kuzzle/commit/4a8038e7729a9cdf5b9d7b2c0540899f8911d11c))
* **storage:** add more types, fix some requests ([a18d454](https://github.com/kuzzleio/kuzzle/commit/a18d454b36d5fe565ad6b08a772c13c3e6a16bab))
* **storage:** upgrade to the Elasticsearch 8 client ([6753640](https://github.com/kuzzleio/kuzzle/commit/675364013e3b07fc665bfea70e2489b28bad0d8e))

# [2.32.0-elasticsearch-8.1](https://github.com/kuzzleio/kuzzle/compare/v2.31.0...v2.32.0-elasticsearch-8.1) (2024-08-28)


### Bug Fixes

* **ci:** indent to pass linter ([f849e2c](https://github.com/kuzzleio/kuzzle/commit/f849e2c9d2aff5a3636a0b2fc0d11ac86561277a))
* **conflicts:** merge conflict ([e763392](https://github.com/kuzzleio/kuzzle/commit/e76339261029262aac31af972dc81f05a082e469))
* **es8:** add elasticsearch-8 in listened branches ([e59cedd](https://github.com/kuzzleio/kuzzle/commit/e59cedd2a2404e315024f18eb3823af03e341411))
* **es8:** update deployment to allow elasticsearch-8 package to be deployed as a pre-release ([8286522](https://github.com/kuzzleio/kuzzle/commit/8286522368ee70efd54a6d631a5917f02d96b952))
* **kuzzleeventemitter:** add missing generics parameters ([48cbcf2](https://github.com/kuzzleio/kuzzle/commit/48cbcf2e2713e96a1e5e21ba6bf23452669edaad))
* **storage:** update more types ([50bfe58](https://github.com/kuzzleio/kuzzle/commit/50bfe580db9e86d6e1de761605ac86debdae2e48))
* **tests:** fixing unit tests ([50f2cac](https://github.com/kuzzleio/kuzzle/commit/50f2cac418f1616ec1c9c68ef149f8072a7a45e4))
* **triggerEvents:** fix response format for request with triggerEvents ([#2546](https://github.com/kuzzleio/kuzzle/issues/2546)) ([ffed901](https://github.com/kuzzleio/kuzzle/commit/ffed901d6051d6c0558019d1b67d30fdec3093ff))


### Features

* **dockerfiles:** move images from bullseye to bookworm ([#2545](https://github.com/kuzzleio/kuzzle/issues/2545)) ([c225aa1](https://github.com/kuzzleio/kuzzle/commit/c225aa183267fcdbd842e37fce1e4091780e7b1d))
* **elasticsearch8:** tests unit are now okay ([1f4d1e8](https://github.com/kuzzleio/kuzzle/commit/1f4d1e8686c3f460496f8a73d983371a173d3a14))
* **es8:** elasticsearch 8 unit tests & functional tests running ([bdcce96](https://github.com/kuzzleio/kuzzle/commit/bdcce96fc97ff58143f29484ae1da2076ee2e885))
* **es8:** support both es7 and es8 ([e12c35a](https://github.com/kuzzleio/kuzzle/commit/e12c35af6b3a8d375005177cdf56509396db5cb4))
* only support ES 8.x ([4a8038e](https://github.com/kuzzleio/kuzzle/commit/4a8038e7729a9cdf5b9d7b2c0540899f8911d11c))
* **storage:** add more types, fix some requests ([a18d454](https://github.com/kuzzleio/kuzzle/commit/a18d454b36d5fe565ad6b08a772c13c3e6a16bab))
* **storage:** upgrade to the Elasticsearch 8 client ([6753640](https://github.com/kuzzleio/kuzzle/commit/675364013e3b07fc665bfea70e2489b28bad0d8e))

# [2.31.0-elasticsearch-8.2](https://github.com/kuzzleio/kuzzle/compare/v2.31.0-elasticsearch-8.1...v2.31.0-elasticsearch-8.2) (2024-06-24)


### Bug Fixes

* **ci:** indent to pass linter ([f849e2c](https://github.com/kuzzleio/kuzzle/commit/f849e2c9d2aff5a3636a0b2fc0d11ac86561277a))

# [2.31.0-elasticsearch-8.1](https://github.com/kuzzleio/kuzzle/compare/v2.30.0...v2.31.0-elasticsearch-8.1) (2024-05-15)


### Bug Fixes

* **conflicts:** merge conflict ([e763392](https://github.com/kuzzleio/kuzzle/commit/e76339261029262aac31af972dc81f05a082e469))
* **es8:** add elasticsearch-8 in listened branches ([e59cedd](https://github.com/kuzzleio/kuzzle/commit/e59cedd2a2404e315024f18eb3823af03e341411))
* **es8:** update deployment to allow elasticsearch-8 package to be deployed as a pre-release ([8286522](https://github.com/kuzzleio/kuzzle/commit/8286522368ee70efd54a6d631a5917f02d96b952))
* **storage:** update more types ([50bfe58](https://github.com/kuzzleio/kuzzle/commit/50bfe580db9e86d6e1de761605ac86debdae2e48))
* **tests:** fixing unit tests ([50f2cac](https://github.com/kuzzleio/kuzzle/commit/50f2cac418f1616ec1c9c68ef149f8072a7a45e4))


### Features

* **elasticsearch8:** tests unit are now okay ([1f4d1e8](https://github.com/kuzzleio/kuzzle/commit/1f4d1e8686c3f460496f8a73d983371a173d3a14))
* **es8:** elasticsearch 8 unit tests & functional tests running ([bdcce96](https://github.com/kuzzleio/kuzzle/commit/bdcce96fc97ff58143f29484ae1da2076ee2e885))
* **es8:** support both es7 and es8 ([e12c35a](https://github.com/kuzzleio/kuzzle/commit/e12c35af6b3a8d375005177cdf56509396db5cb4))
* only support ES 8.x ([4a8038e](https://github.com/kuzzleio/kuzzle/commit/4a8038e7729a9cdf5b9d7b2c0540899f8911d11c))
* **storage:** add more types, fix some requests ([a18d454](https://github.com/kuzzleio/kuzzle/commit/a18d454b36d5fe565ad6b08a772c13c3e6a16bab))
* **storage:** upgrade to the Elasticsearch 8 client ([6753640](https://github.com/kuzzleio/kuzzle/commit/675364013e3b07fc665bfea70e2489b28bad0d8e))


# [2.31.0](https://github.com/kuzzleio/kuzzle/compare/v2.30.0...v2.31.0) (2024-07-22)


### Bug Fixes

* **doc:** fix a typo in documentation ([35256f0](https://github.com/kuzzleio/kuzzle/commit/35256f0299c01424af397707c02062128ebc98b2))
* hmset accepts value: 0 ([d973c4f](https://github.com/kuzzleio/kuzzle/commit/d973c4fe3f0b1d51d8389c606e5f3e1b31b47b86))
* mset accepts value: 0 ([d8168a8](https://github.com/kuzzleio/kuzzle/commit/d8168a8c5158c4ebcf7a51dddcaa9b2fa5fa1e65))


### Features

* **doc:** add documentation in the event-system guide ([4913389](https://github.com/kuzzleio/kuzzle/commit/4913389e4be38f3cb23d85ca2bc769fc979dd64e))
* **funnel:** add optional parameter to request to trigger pipes ([508ac72](https://github.com/kuzzleio/kuzzle/commit/508ac72a25b690ac452ff32dbe80e0833c00290d))

# [2.31.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.30.1-beta.1...v2.31.0-beta.1) (2024-07-22)


### Features

* **doc:** add documentation in the event-system guide ([4913389](https://github.com/kuzzleio/kuzzle/commit/4913389e4be38f3cb23d85ca2bc769fc979dd64e))
* **funnel:** add optional parameter to request to trigger pipes ([508ac72](https://github.com/kuzzleio/kuzzle/commit/508ac72a25b690ac452ff32dbe80e0833c00290d))

## [2.30.1-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.30.0...v2.30.1-beta.1) (2024-06-03)


### Bug Fixes

* **doc:** fix a typo in documentation ([35256f0](https://github.com/kuzzleio/kuzzle/commit/35256f0299c01424af397707c02062128ebc98b2))
* hmset accepts value: 0 ([d973c4f](https://github.com/kuzzleio/kuzzle/commit/d973c4fe3f0b1d51d8389c606e5f3e1b31b47b86))
* mset accepts value: 0 ([d8168a8](https://github.com/kuzzleio/kuzzle/commit/d8168a8c5158c4ebcf7a51dddcaa9b2fa5fa1e65))

# [2.30.0](https://github.com/kuzzleio/kuzzle/compare/v2.29.1...v2.30.0) (2024-05-07)


### Bug Fixes

* **objectrepository:** fix SonarCloud minor issues ([6696cab](https://github.com/kuzzleio/kuzzle/commit/6696cab5b7c8e9bd75434383fa1c166b2ed7c085))


### Features

* **index:** export Store and ObjectRepository ([8b6e4e7](https://github.com/kuzzleio/kuzzle/commit/8b6e4e74f888c59d2d9d485a11951f513b9c63aa))
* **index:** expose cacheDbEnum and storeScopeEnum ([b52f6f2](https://github.com/kuzzleio/kuzzle/commit/b52f6f20b84b9b38484f24b04a28a4894f35b416))

## [2.29.1](https://github.com/kuzzleio/kuzzle/compare/v2.29.0...v2.29.1) (2024-04-02)


### Bug Fixes

* **global:** fix global types ([b4661b9](https://github.com/kuzzleio/kuzzle/commit/b4661b9e1e2d8c169d93e7a17f030338875faed0))
* **openapi:** remove dedicated components files as we need to generate it automaticaly ([a3036f6](https://github.com/kuzzleio/kuzzle/commit/a3036f6336c1c6e14eb874acde04976f3de1c1ed))
* **settings:** elasticsearch default setting on imports collection ([228482a](https://github.com/kuzzleio/kuzzle/commit/228482af41b822c0e064286083811c9aca95e532))
* **ts:** export Kuzzle class so typedef is generated ([448c235](https://github.com/kuzzleio/kuzzle/commit/448c235ef3db8316f02b00d997a48a7e3a30784c))

## [2.29.1-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.29.1-beta.1...v2.29.1-beta.2) (2024-03-22)


### Bug Fixes

* **global:** fix global types ([b4661b9](https://github.com/kuzzleio/kuzzle/commit/b4661b9e1e2d8c169d93e7a17f030338875faed0))
* **ts:** export Kuzzle class so typedef is generated ([448c235](https://github.com/kuzzleio/kuzzle/commit/448c235ef3db8316f02b00d997a48a7e3a30784c))

## [2.29.1-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.29.0...v2.29.1-beta.1) (2024-03-13)


### Bug Fixes

* **openapi:** remove dedicated components files as we need to generate it automaticaly ([a3036f6](https://github.com/kuzzleio/kuzzle/commit/a3036f6336c1c6e14eb874acde04976f3de1c1ed))
* **settings:** elasticsearch default setting on imports collection ([228482a](https://github.com/kuzzleio/kuzzle/commit/228482af41b822c0e064286083811c9aca95e532))

# [2.29.0](https://github.com/kuzzleio/kuzzle/compare/v2.28.0...v2.29.0) (2024-02-01)


### Bug Fixes

* **cluster:** update a condition where node were evicted for a wrong reason ([8dae2bc](https://github.com/kuzzleio/kuzzle/commit/8dae2bce91240d5851b58cd1f5c10d0525a07d41))
* **kuzzlerc:** there was a mismatch between default variable and kuzzlerc example ([32a3853](https://github.com/kuzzleio/kuzzle/commit/32a3853bdbc68f969c15e23faa1b40c6fbfa1194))
* **lint:** fixed lint and ts issues in elasticsearch file ([4acba1f](https://github.com/kuzzleio/kuzzle/commit/4acba1f71a683d4cf30ef67f011763d2e83f66ba))
* **semantic-release:** fix an issue where semver would not satisfies pre-release versions ([cc0f9f0](https://github.com/kuzzleio/kuzzle/commit/cc0f9f0e2051ad970791ee9254ea915a3c5f6f37))
* **semantic:** update workflow to match beta branch from semantic ([51d92b6](https://github.com/kuzzleio/kuzzle/commit/51d92b69b7d347b5808e9073bdbe8266117d8353))


### Features

* **semantic-release:** add semantic release ([dba84a4](https://github.com/kuzzleio/kuzzle/commit/dba84a4788bcf0ff20000002891f859f4b8a420e))

# [2.29.0-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.29.0-beta.1...v2.29.0-beta.2) (2024-02-01)


### Bug Fixes

* **cluster:** update a condition where node were evicted for a wrong reason ([8dae2bc](https://github.com/kuzzleio/kuzzle/commit/8dae2bce91240d5851b58cd1f5c10d0525a07d41))
* **semantic-release:** fix an issue where semver would not satisfies pre-release versions ([cc0f9f0](https://github.com/kuzzleio/kuzzle/commit/cc0f9f0e2051ad970791ee9254ea915a3c5f6f37))

# [2.29.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.28.0...v2.29.0-beta.1) (2024-01-16)


### Bug Fixes

* **kuzzlerc:** there was a mismatch between default variable and kuzzlerc example ([32a3853](https://github.com/kuzzleio/kuzzle/commit/32a3853bdbc68f969c15e23faa1b40c6fbfa1194))
* **lint:** fixed lint and ts issues in elasticsearch file ([4acba1f](https://github.com/kuzzleio/kuzzle/commit/4acba1f71a683d4cf30ef67f011763d2e83f66ba))
* **semantic:** update workflow to match beta branch from semantic ([51d92b6](https://github.com/kuzzleio/kuzzle/commit/51d92b69b7d347b5808e9073bdbe8266117d8353))


### Features

* **semantic-release:** add semantic release ([dba84a4](https://github.com/kuzzleio/kuzzle/commit/dba84a4788bcf0ff20000002891f859f4b8a420e))
