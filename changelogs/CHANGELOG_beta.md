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
