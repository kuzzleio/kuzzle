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
