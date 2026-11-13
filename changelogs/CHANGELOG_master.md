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
