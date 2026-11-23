## [2.62.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.61.4-beta.2...v2.62.0-beta.1) (2026-11-23)

### Features

* **storage:** announce the background reindex a mapping update starts ([e02ba23](https://github.com/kuzzleio/kuzzle/commit/e02ba23ceceef28389d7c4022a939ed89ec76624))

### Bug Fixes

* **deps:** kuzzle-storage-es-7 and kuzzle-storage-es-8 1.2.0-beta.1 ([ca1fd88](https://github.com/kuzzleio/kuzzle/commit/ca1fd88327a600958b9b2b025e69502ef554986d)), closes [#3226](https://github.com/kuzzleio/kuzzle/issues/3226)
* **roles:** do not store unloaded role to the cache ([ebeb698](https://github.com/kuzzleio/kuzzle/commit/ebeb698ebd0f5a5fa5c7ba1e08e7d20ee70282f9))

## [2.61.4-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.61.4-beta.1...v2.61.4-beta.2) (2026-11-23)

### Bug Fixes

* **core:** keep a signal received while the application loads ([#3223](https://github.com/kuzzleio/kuzzle/issues/3223)) ([baa6c4c](https://github.com/kuzzleio/kuzzle/commit/baa6c4c5d7086758d7c21bc3bd8abc791010f784))

## [2.61.4-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.61.3...v2.61.4-beta.1) (2026-11-22)

### Bug Fixes

* **core:** exit on SIGTERM / SIGINT received while Kuzzle loads ([#3087](https://github.com/kuzzleio/kuzzle/issues/3087)) ([ec7c0b3](https://github.com/kuzzleio/kuzzle/commit/ec7c0b390a16b65d0a00b6374da14537cd2d3bab))
* **core:** give back the cluster-wide locks first on a graceful shutdown ([b58ef28](https://github.com/kuzzleio/kuzzle/commit/b58ef281b0be82817501aeddb9a49f93d3a0f11f))
* **core:** keep a lock until its code ends on a graceful stop ([#3218](https://github.com/kuzzleio/kuzzle/issues/3218)) ([7eaa1d2](https://github.com/kuzzleio/kuzzle/commit/7eaa1d233a09c1c55d6311b0fdad4cd1f4099321)), closes [#3217](https://github.com/kuzzleio/kuzzle/issues/3217) [#3217](https://github.com/kuzzleio/kuzzle/issues/3217)
* **core:** release a lock given back at shutdown only once ([368d57e](https://github.com/kuzzleio/kuzzle/commit/368d57e053da5d4c4852686d8d7bfc8d49ab5bb3)), closes [#3212](https://github.com/kuzzleio/kuzzle/issues/3212)
* **core:** release a lock with a plain EVAL, without a local SHA-1 ([9d3babe](https://github.com/kuzzleio/kuzzle/commit/9d3babed441d7916814ea935246d43b953db3898))
* **withLock:** log a warning when a holder finds out it lost its lock ([#3212](https://github.com/kuzzleio/kuzzle/issues/3212)) ([66bfe74](https://github.com/kuzzleio/kuzzle/commit/66bfe74642fa350565ddde6c811e341041a1ea73))

## [2.61.3-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.61.3-beta.1...v2.61.3-beta.2) (2026-11-20)

### Bug Fixes

* **lock:** let every cluster-wide lock expire in 10 s, extended every third of it ([b5eda38](https://github.com/kuzzleio/kuzzle/commit/b5eda38f29ce051aae2e93a77cc350509073734a)), closes [#3207](https://github.com/kuzzleio/kuzzle/issues/3207) [#3208](https://github.com/kuzzleio/kuzzle/issues/3208)
* **plugins:** say whether a lock a timed out init waited for is held by this node ([93e04d2](https://github.com/kuzzleio/kuzzle/commit/93e04d24cd1c3ff536234204cc75ae48e58227ca)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)

## [2.61.3-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.61.2...v2.61.3-beta.1) (2026-11-19)

### Bug Fixes

* **plugins:** name the cluster-wide lock a timed out plugin init waited for ([fbfde37](https://github.com/kuzzleio/kuzzle/commit/fbfde37845e463a598234c826567a7e3dee00c22)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)
* **process:** log a thrown value that is not an Error before exiting ([1cdc477](https://github.com/kuzzleio/kuzzle/commit/1cdc4774fa0e294a122c30f62b7dbd791bca43e3)), closes [kuzzleio/kuzzle-plugin-auth-openid#50](https://github.com/kuzzleio/kuzzle-plugin-auth-openid/issues/50)
* **start:** log a failed start once ([2c33be0](https://github.com/kuzzleio/kuzzle/commit/2c33be073e927f4056619bda60e9e86b535578d1)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)
* **store:** let the Store.init lock expire in 10 s ([d18a9a6](https://github.com/kuzzleio/kuzzle/commit/d18a9a662cea6f7c0284b01b4be9639fe5a27a80)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)

## [2.61.2-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.61.2-beta.1...v2.61.2-beta.2) (2026-11-13)

### Bug Fixes

* **security:** answer a cache timeout during token check as services.cache.timeout (503) ([44aa64b](https://github.com/kuzzleio/kuzzle/commit/44aa64be81316bbcda9b3f60b75a18a900df4f3a))

## [2.61.2-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.61.1...v2.61.2-beta.1) (2026-11-13)

### Bug Fixes

* **cache:** answer a Redis commandTimeout as services.cache.timeout (503) ([63ace34](https://github.com/kuzzleio/kuzzle/commit/63ace347fdf6611ae10af5ca48b7b9331c0829c2))
* **cache:** narrow commandTimeout before naming it in the error ([38e34e7](https://github.com/kuzzleio/kuzzle/commit/38e34e7a6a748d0445c0577bd3e04a7d7c4ed2d8))
* **cache:** reject searchKeys when its SCAN fails ([f3f15d1](https://github.com/kuzzleio/kuzzle/commit/f3f15d1fd1a7d348cf65697322b8e5aa29eae219))

## [2.61.1-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.61.1-beta.1...v2.61.1-beta.2) (2026-11-12)

### Bug Fixes

* **cluster:** bound the Redis calls of the shutdown a failed renewal starts ([180210c](https://github.com/kuzzleio/kuzzle/commit/180210c2abbf3654290ca125800c34a09773b81c)), closes [#3182](https://github.com/kuzzleio/kuzzle/issues/3182) [#3181](https://github.com/kuzzleio/kuzzle/issues/3181)

## [2.61.1-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.61.0...v2.61.1-beta.1) (2026-11-12)

### Bug Fixes

* **cache:** report Valkey's own version and mode in server:info ([4300c1f](https://github.com/kuzzleio/kuzzle/commit/4300c1fea52895227d2543ee3658d3122ff562a5))
* **cluster:** bound each ID card renewal by the heartbeat delay ([5217227](https://github.com/kuzzleio/kuzzle/commit/5217227ebbfe53e592be317a93828199022bca76)), closes [#3181](https://github.com/kuzzleio/kuzzle/issues/3181)
* **deps:** kuzzle-storage-es-7 and kuzzle-storage-es-8 1.1.1 ([64bbca4](https://github.com/kuzzleio/kuzzle/commit/64bbca47052a0d67fd4605404363e3902ee9443e)), closes [kuzzleio/storage-es-8#9](https://github.com/kuzzleio/storage-es-8/issues/9)

## [2.61.0-beta.9](https://github.com/kuzzleio/kuzzle/compare/v2.61.0-beta.8...v2.61.0-beta.9) (2026-11-04)

### Bug Fixes

* SonarCloud findings blocking 2.61.0 ([6bfb69c](https://github.com/kuzzleio/kuzzle/commit/6bfb69cecc100cdadcd359b80c0bec4e8428ed9f)), closes [#3167](https://github.com/kuzzleio/kuzzle/issues/3167)

## [2.61.0-beta.8](https://github.com/kuzzleio/kuzzle/compare/v2.61.0-beta.7...v2.61.0-beta.8) (2026-11-03)

### Dependencies

* **deps:** storage drivers at their stable releases ([2297fa7](https://github.com/kuzzleio/kuzzle/commit/2297fa725e04c6068ddf884aa30b43426db05553))

## [2.61.0-beta.7](https://github.com/kuzzleio/kuzzle/compare/v2.61.0-beta.6...v2.61.0-beta.7) (2026-11-03)

### Bug Fixes

* **shutdown:** wait for plugin requests before closing the storage ([11fb1f0](https://github.com/kuzzleio/kuzzle/commit/11fb1f0889bec168c9f8bad0d8c0ec7aeda4d994)), closes [#3160](https://github.com/kuzzleio/kuzzle/issues/3160)

## [2.61.0-beta.6](https://github.com/kuzzleio/kuzzle/compare/v2.61.0-beta.5...v2.61.0-beta.6) (2026-11-03)

### Dependencies

* **deps:** patch and minor bumps ([6a2fc73](https://github.com/kuzzleio/kuzzle/commit/6a2fc73ddacb167b0bb95b60eb09b9b2d525087e))
* **deps:** semantic-release-config-kuzzle 1.8.0 ([e02e258](https://github.com/kuzzleio/kuzzle/commit/e02e258d8217a85b4815e78200e4c26d56e2d703))
* **deps:** storage drivers with the close() hook ([942f59d](https://github.com/kuzzleio/kuzzle/commit/942f59d9acedced0cc0114ef1c0b40ef00813a3c)), closes [#3141](https://github.com/kuzzleio/kuzzle/issues/3141) [#3133](https://github.com/kuzzleio/kuzzle/issues/3133)
* **deps:** storage drivers with the fixed error mapping ([1c8d956](https://github.com/kuzzleio/kuzzle/commit/1c8d956c31e6faf3c4cb481860028a69bd6ab89d)), closes [#3145](https://github.com/kuzzleio/kuzzle/issues/3145)
* **deps:** strip-json-comments 5 from npm ([2e50551](https://github.com/kuzzleio/kuzzle/commit/2e50551a669ef62453d030ee9a73586fbd7d408c))
* **deps:** uuid 14 ([9b15289](https://github.com/kuzzleio/kuzzle/commit/9b15289f2cf8bc846a4ff9298a5c0c63a48c1613))

### Features

* **storage:** expose the selected storage engine to plugins and apps ([0388a74](https://github.com/kuzzleio/kuzzle/commit/0388a7493388711ff265fccd41c4b8bea3ca4110)), closes [#3133](https://github.com/kuzzleio/kuzzle/issues/3133)
* **storage:** optional close() driver hook called on shutdown ([e7f8ce5](https://github.com/kuzzleio/kuzzle/commit/e7f8ce55da07b280d24c9b7767315c7866cc6478)), closes [#3141](https://github.com/kuzzleio/kuzzle/issues/3141)

### Bug Fixes

* **cluster:** compare storage drivers before the storage initializes ([fd04323](https://github.com/kuzzleio/kuzzle/commit/fd04323f70364194e47e11f51d1c2ec67f04e878)), closes [#3139](https://github.com/kuzzleio/kuzzle/issues/3139)
* **storage:** await each driver close in the conformance kit (Sonar S4123) ([32ee82f](https://github.com/kuzzleio/kuzzle/commit/32ee82fc416bb4cfb67486323d0d5f6f8b4b60cf))
* **storage:** engine-neutral wording in storage error messages and logs ([e240b35](https://github.com/kuzzleio/kuzzle/commit/e240b35eef98dba21ad2406ac9bab408cc89c764)), closes [#3143](https://github.com/kuzzleio/kuzzle/issues/3143)
* **storage:** harden the storage driver loader ([76219e6](https://github.com/kuzzleio/kuzzle/commit/76219e647806f2221173e7e9d1e9a35b664d152c)), closes [#3132](https://github.com/kuzzleio/kuzzle/issues/3132) [#3134](https://github.com/kuzzleio/kuzzle/issues/3134) [#3137](https://github.com/kuzzleio/kuzzle/issues/3137) [#3142](https://github.com/kuzzleio/kuzzle/issues/3142)

### Performance Improvements

* **storage:** rate-limit the storage reads index cache misses trigger ([f96c0e9](https://github.com/kuzzleio/kuzzle/commit/f96c0e9f715ae4e014f33e88006d351faa698b7e)), closes [kuzzle#3121](https://github.com/kuzzleio/kuzzle/issues/3121) [kuzzle#3121](https://github.com/kuzzleio/kuzzle/issues/3121) [#3140](https://github.com/kuzzleio/kuzzle/issues/3140)
