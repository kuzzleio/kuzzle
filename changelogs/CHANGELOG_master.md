## [2.63.0](https://github.com/kuzzleio/kuzzle/compare/v2.62.0...v2.63.0) (2026-11-25)

### Features

* **storage:** document min_score, track_scores and search.additionalBodyKeys ([b706eae](https://github.com/kuzzleio/kuzzle/commit/b706eaea781d8b3b207b0beb40c6ec3e8f595c17))

### Bug Fixes

* **deps:** koncorde and the ES 7/8 drivers betas without advisories or a kuzzle copy ([73f74d1](https://github.com/kuzzleio/kuzzle/commit/73f74d10845258f01d8dee3e4d77279bd5a40754)), closes [#3252](https://github.com/kuzzleio/kuzzle/issues/3252)
* **deps:** kuzzle-storage-es-7 and kuzzle-storage-es-8 1.3.0-beta.1 ([b63278e](https://github.com/kuzzleio/kuzzle/commit/b63278ec8251c34efb798f53d98cced083e9ef55)), closes [#3256](https://github.com/kuzzleio/kuzzle/issues/3256)
* **deps:** refresh the lockfile against production advisories ([53b803c](https://github.com/kuzzleio/kuzzle/commit/53b803c8874d17a5c52b066b0e313c5fbfb0d170))
* **deps:** stable koncorde 4.8.1 and kuzzle-sdk 7.19.1 (security advisories) ([64eb168](https://github.com/kuzzleio/kuzzle/commit/64eb16814b32c9e42c71da0a593fff255dadd32f))
* **deps:** storage drivers stable (es 1.3.0, opensearch 1.1.0) ([57539ae](https://github.com/kuzzleio/kuzzle/commit/57539ae667647acfe0787c02ce6b8a0918bd5422))
* **storage:** give the built-in drivers the running Kuzzle without a copy ([7756e2e](https://github.com/kuzzleio/kuzzle/commit/7756e2ed7e01ced5abb01fa3d5cec7cf48e680f4))
* **storage:** keep an index or collection changed twice during a cache reload ([355901a](https://github.com/kuzzleio/kuzzle/commit/355901adf92cffceb9d0ec43f3bcc961496bebb1)), closes [#3126](https://github.com/kuzzleio/kuzzle/issues/3126)
* **storage:** let the newer read win when concurrent reloads end in order ([ab2ebc8](https://github.com/kuzzleio/kuzzle/commit/ab2ebc8f1fb6e4ff2222cc72ca772ce761a62469)), closes [kuzzle#3126](https://github.com/kuzzleio/kuzzle/issues/3126)

## [2.62.0](https://github.com/kuzzleio/kuzzle/compare/v2.61.3...v2.62.0) (2026-11-23)

### Features

* **storage:** announce the background reindex a mapping update starts ([e02ba23](https://github.com/kuzzleio/kuzzle/commit/e02ba23ceceef28389d7c4022a939ed89ec76624))

### Bug Fixes

* **core:** exit on SIGTERM / SIGINT received while Kuzzle loads ([#3087](https://github.com/kuzzleio/kuzzle/issues/3087)) ([ec7c0b3](https://github.com/kuzzleio/kuzzle/commit/ec7c0b390a16b65d0a00b6374da14537cd2d3bab))
* **core:** give back the cluster-wide locks first on a graceful shutdown ([b58ef28](https://github.com/kuzzleio/kuzzle/commit/b58ef281b0be82817501aeddb9a49f93d3a0f11f))
* **core:** keep a lock until its code ends on a graceful stop ([#3218](https://github.com/kuzzleio/kuzzle/issues/3218)) ([7eaa1d2](https://github.com/kuzzleio/kuzzle/commit/7eaa1d233a09c1c55d6311b0fdad4cd1f4099321)), closes [#3217](https://github.com/kuzzleio/kuzzle/issues/3217) [#3217](https://github.com/kuzzleio/kuzzle/issues/3217)
* **core:** keep a signal received while the application loads ([#3223](https://github.com/kuzzleio/kuzzle/issues/3223)) ([baa6c4c](https://github.com/kuzzleio/kuzzle/commit/baa6c4c5d7086758d7c21bc3bd8abc791010f784))
* **core:** release a lock given back at shutdown only once ([368d57e](https://github.com/kuzzleio/kuzzle/commit/368d57e053da5d4c4852686d8d7bfc8d49ab5bb3)), closes [#3212](https://github.com/kuzzleio/kuzzle/issues/3212)
* **core:** release a lock with a plain EVAL, without a local SHA-1 ([9d3babe](https://github.com/kuzzleio/kuzzle/commit/9d3babed441d7916814ea935246d43b953db3898))
* **deps:** kuzzle-storage-es-7 and kuzzle-storage-es-8 1.2.0 ([a9e24b2](https://github.com/kuzzleio/kuzzle/commit/a9e24b2ac4f6e594cfe4d7ae211d3651250a8941))
* **deps:** kuzzle-storage-es-7 and kuzzle-storage-es-8 1.2.0-beta.1 ([ca1fd88](https://github.com/kuzzleio/kuzzle/commit/ca1fd88327a600958b9b2b025e69502ef554986d)), closes [#3226](https://github.com/kuzzleio/kuzzle/issues/3226)
* **roles:** do not store unloaded role to the cache ([ebeb698](https://github.com/kuzzleio/kuzzle/commit/ebeb698ebd0f5a5fa5c7ba1e08e7d20ee70282f9))
* **withLock:** log a warning when a holder finds out it lost its lock ([#3212](https://github.com/kuzzleio/kuzzle/issues/3212)) ([66bfe74](https://github.com/kuzzleio/kuzzle/commit/66bfe74642fa350565ddde6c811e341041a1ea73))

## [2.61.3](https://github.com/kuzzleio/kuzzle/compare/v2.61.2...v2.61.3) (2026-11-20)

### Bug Fixes

* **lock:** let every cluster-wide lock expire in 10 s, extended every third of it ([b5eda38](https://github.com/kuzzleio/kuzzle/commit/b5eda38f29ce051aae2e93a77cc350509073734a)), closes [#3207](https://github.com/kuzzleio/kuzzle/issues/3207) [#3208](https://github.com/kuzzleio/kuzzle/issues/3208)
* **plugins:** name the cluster-wide lock a timed out plugin init waited for ([fbfde37](https://github.com/kuzzleio/kuzzle/commit/fbfde37845e463a598234c826567a7e3dee00c22)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)
* **plugins:** say whether a lock a timed out init waited for is held by this node ([93e04d2](https://github.com/kuzzleio/kuzzle/commit/93e04d24cd1c3ff536234204cc75ae48e58227ca)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)
* **process:** log a thrown value that is not an Error before exiting ([1cdc477](https://github.com/kuzzleio/kuzzle/commit/1cdc4774fa0e294a122c30f62b7dbd791bca43e3)), closes [kuzzleio/kuzzle-plugin-auth-openid#50](https://github.com/kuzzleio/kuzzle-plugin-auth-openid/issues/50)
* **start:** log a failed start once ([2c33be0](https://github.com/kuzzleio/kuzzle/commit/2c33be073e927f4056619bda60e9e86b535578d1)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)
* **store:** let the Store.init lock expire in 10 s ([d18a9a6](https://github.com/kuzzleio/kuzzle/commit/d18a9a662cea6f7c0284b01b4be9639fe5a27a80)), closes [#3156](https://github.com/kuzzleio/kuzzle/issues/3156)

## [2.61.2](https://github.com/kuzzleio/kuzzle/compare/v2.61.1...v2.61.2) (2026-11-14)

### Bug Fixes

* **cache:** answer a Redis commandTimeout as services.cache.timeout (503) ([63ace34](https://github.com/kuzzleio/kuzzle/commit/63ace347fdf6611ae10af5ca48b7b9331c0829c2))
* **cache:** narrow commandTimeout before naming it in the error ([38e34e7](https://github.com/kuzzleio/kuzzle/commit/38e34e7a6a748d0445c0577bd3e04a7d7c4ed2d8))
* **cache:** reject searchKeys when its SCAN fails ([f3f15d1](https://github.com/kuzzleio/kuzzle/commit/f3f15d1fd1a7d348cf65697322b8e5aa29eae219))
* **security:** answer a cache timeout during token check as services.cache.timeout (503) ([44aa64b](https://github.com/kuzzleio/kuzzle/commit/44aa64be81316bbcda9b3f60b75a18a900df4f3a))

## [2.61.1](https://github.com/kuzzleio/kuzzle/compare/v2.61.0...v2.61.1) (2026-11-12)

### Bug Fixes

* **cache:** report Valkey's own version and mode in server:info ([4300c1f](https://github.com/kuzzleio/kuzzle/commit/4300c1fea52895227d2543ee3658d3122ff562a5))
* **cluster:** bound each ID card renewal by the heartbeat delay ([5217227](https://github.com/kuzzleio/kuzzle/commit/5217227ebbfe53e592be317a93828199022bca76)), closes [#3181](https://github.com/kuzzleio/kuzzle/issues/3181)
* **cluster:** bound the Redis calls of the shutdown a failed renewal starts ([180210c](https://github.com/kuzzleio/kuzzle/commit/180210c2abbf3654290ca125800c34a09773b81c)), closes [#3182](https://github.com/kuzzleio/kuzzle/issues/3182) [#3181](https://github.com/kuzzleio/kuzzle/issues/3181)
* **deps:** kuzzle-storage-es-7 and kuzzle-storage-es-8 1.1.1 ([64bbca4](https://github.com/kuzzleio/kuzzle/commit/64bbca47052a0d67fd4605404363e3902ee9443e)), closes [kuzzleio/storage-es-8#9](https://github.com/kuzzleio/storage-es-8/issues/9)

## [2.61.0](https://github.com/kuzzleio/kuzzle/compare/v2.60.1...v2.61.0) (2026-11-04)

### Dependencies

* **deps:** patch and minor bumps ([6a2fc73](https://github.com/kuzzleio/kuzzle/commit/6a2fc73ddacb167b0bb95b60eb09b9b2d525087e))
* **deps:** pin kuzzle-storage-es-7 and -8 to 1.0.0 ([80bce75](https://github.com/kuzzleio/kuzzle/commit/80bce75483b89469602b086d32f1dd4814cb7e2d)), closes [storage-es-7#2](https://github.com/kuzzleio/storage-es-7/issues/2) [storage-es-8#2](https://github.com/kuzzleio/storage-es-8/issues/2) [storage-es-9#3](https://github.com/kuzzleio/storage-es-9/issues/3)
* **deps:** semantic-release-config-kuzzle 1.8.0 ([e02e258](https://github.com/kuzzleio/kuzzle/commit/e02e258d8217a85b4815e78200e4c26d56e2d703))
* **deps:** storage drivers at their stable releases ([2297fa7](https://github.com/kuzzleio/kuzzle/commit/2297fa725e04c6068ddf884aa30b43426db05553))
* **deps:** storage drivers with the close() hook ([942f59d](https://github.com/kuzzleio/kuzzle/commit/942f59d9acedced0cc0114ef1c0b40ef00813a3c)), closes [#3141](https://github.com/kuzzleio/kuzzle/issues/3141) [#3133](https://github.com/kuzzleio/kuzzle/issues/3133)
* **deps:** storage drivers with the fixed error mapping ([1c8d956](https://github.com/kuzzleio/kuzzle/commit/1c8d956c31e6faf3c4cb481860028a69bd6ab89d)), closes [#3145](https://github.com/kuzzleio/kuzzle/issues/3145)
* **deps:** strip-json-comments 5 from npm ([2e50551](https://github.com/kuzzleio/kuzzle/commit/2e50551a669ef62453d030ee9a73586fbd7d408c))
* **deps:** uuid 14 ([9b15289](https://github.com/kuzzleio/kuzzle/commit/9b15289f2cf8bc846a4ff9298a5c0c63a48c1613))

### Features

* **storage:** add the StorageDriver contract (ADR-0003 step 01) ([eecd7f1](https://github.com/kuzzleio/kuzzle/commit/eecd7f1050d8927ce869a739fd2c6b99d1053fa7))
* **storage:** export storageError for the storage drivers ([f5c0e8d](https://github.com/kuzzleio/kuzzle/commit/f5c0e8de2c00ea8de83db5834a358114bc1138c7))
* **storage:** expose the selected storage engine to plugins and apps ([0388a74](https://github.com/kuzzleio/kuzzle/commit/0388a7493388711ff265fccd41c4b8bea3ca4110)), closes [#3133](https://github.com/kuzzleio/kuzzle/issues/3133)
* **storage:** load storage drivers selected by configuration (ADR-0003 step 03) ([d26efc3](https://github.com/kuzzleio/kuzzle/commit/d26efc3d173eab74903669fcba6e24f79cd21179))
* **storage:** OpenSearch 2 and 3 drivers in the functional matrix (ADR-0003 step 07) ([4661f5a](https://github.com/kuzzleio/kuzzle/commit/4661f5ae698e161dd3acad4fb19a49c29ccd5624))
* **storage:** optional close() driver hook called on shutdown ([e7f8ce5](https://github.com/kuzzleio/kuzzle/commit/e7f8ce55da07b280d24c9b7767315c7866cc6478)), closes [#3141](https://github.com/kuzzleio/kuzzle/issues/3141)
* **storage:** run ES7 / ES8 as built-in storage drivers (ADR-0003 step 02) ([23aa60d](https://github.com/kuzzleio/kuzzle/commit/23aa60d8d7d9507ab20a005460a2a17147865c11))
* **storage:** run ES7 / ES8 from the kuzzle-storage-es-7 / -8 packages (ADR-0003 step 06) ([7478575](https://github.com/kuzzleio/kuzzle/commit/747857509fd4048ed28557c2e7c689196fd8d501))
* **storage:** storage driver conformance kit (ADR-0003 step 04) ([e06639c](https://github.com/kuzzleio/kuzzle/commit/e06639ceac5a250e51beb00575c9bcf53dcc190d))
* **storage:** warn when majorVersion is set along with a storage driver ([e5aa782](https://github.com/kuzzleio/kuzzle/commit/e5aa78236f673bb5d9c61cbebc796b6cf60b7d44))

### Bug Fixes

* **cluster:** compare storage drivers before the storage initializes ([fd04323](https://github.com/kuzzleio/kuzzle/commit/fd04323f70364194e47e11f51d1c2ec67f04e878)), closes [#3139](https://github.com/kuzzleio/kuzzle/issues/3139)
* **shutdown:** wait for plugin requests before closing the storage ([11fb1f0](https://github.com/kuzzleio/kuzzle/commit/11fb1f0889bec168c9f8bad0d8c0ec7aeda4d994)), closes [#3160](https://github.com/kuzzleio/kuzzle/issues/3160)
* SonarCloud findings blocking 2.61.0 ([6bfb69c](https://github.com/kuzzleio/kuzzle/commit/6bfb69cecc100cdadcd359b80c0bec4e8428ed9f)), closes [#3167](https://github.com/kuzzleio/kuzzle/issues/3167)
* **storage:** await each driver close in the conformance kit (Sonar S4123) ([32ee82f](https://github.com/kuzzleio/kuzzle/commit/32ee82fc416bb4cfb67486323d0d5f6f8b4b60cf))
* **storage:** check storage before a cluster node reports a missing index or collection ([277fec4](https://github.com/kuzzleio/kuzzle/commit/277fec40906a4d7e7ad8778227b7682dfb2249f9)), closes [#3121](https://github.com/kuzzleio/kuzzle/issues/3121)
* **storage:** engine-neutral wording in storage error messages and logs ([e240b35](https://github.com/kuzzleio/kuzzle/commit/e240b35eef98dba21ad2406ac9bab408cc89c764)), closes [#3143](https://github.com/kuzzleio/kuzzle/issues/3143)
* **storage:** harden the storage driver loader ([76219e6](https://github.com/kuzzleio/kuzzle/commit/76219e647806f2221173e7e9d1e9a35b664d152c)), closes [#3132](https://github.com/kuzzleio/kuzzle/issues/3132) [#3134](https://github.com/kuzzleio/kuzzle/issues/3134) [#3137](https://github.com/kuzzleio/kuzzle/issues/3137) [#3142](https://github.com/kuzzleio/kuzzle/issues/3142)
* **storage:** name the ES9 driver kuzzle-storage-es-9, unscoped ([e7aa585](https://github.com/kuzzleio/kuzzle/commit/e7aa5850937970e05901c2c8c6e73ddf582b2ed8))
* **storage:** replace the index cache on reload instead of merging into it ([8bef63e](https://github.com/kuzzleio/kuzzle/commit/8bef63ed61c744b95ac1b8b5d3c2503b83e4dc70)), closes [#3040](https://github.com/kuzzleio/kuzzle/issues/3040)
* **storage:** throw services.storage_driver.not_found for a missing built-in driver package ([104d654](https://github.com/kuzzleio/kuzzle/commit/104d654cd15bd1c09f57b614a01120b8cc097342)), closes [#3116](https://github.com/kuzzleio/kuzzle/issues/3116)

### Performance Improvements

* **storage:** rate-limit the storage reads index cache misses trigger ([f96c0e9](https://github.com/kuzzleio/kuzzle/commit/f96c0e9f715ae4e014f33e88006d351faa698b7e)), closes [kuzzle#3121](https://github.com/kuzzleio/kuzzle/issues/3121) [kuzzle#3121](https://github.com/kuzzleio/kuzzle/issues/3121) [#3140](https://github.com/kuzzleio/kuzzle/issues/3140)
