## [2.57.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.56.0...v2.57.0-beta.1) (2026-09-26)

### Features

* **apiKeys:** allow an api key to be deleted by the key itself or its fingerprint ([#2683](https://github.com/kuzzleio/kuzzle/issues/2683)) ([e172c73](https://github.com/kuzzleio/kuzzle/commit/e172c730e24f40040f0a8d61951b66accde2ee32))
* **ci:** ratchet implicit any, and count `as unknown as` as any ([34e29d9](https://github.com/kuzzleio/kuzzle/commit/34e29d9c42bd436a71a3223c0e09bf6c47375722))
* **cluster:** retransmit lost sync messages before evicting ([#2785](https://github.com/kuzzleio/kuzzle/issues/2785)) ([0807880](https://github.com/kuzzleio/kuzzle/commit/0807880a84ae4879d6bb6df2f9a1dd5de6c09a54))
* **h4:** convert lib/core/validation/validation.js to TypeScript ([787cfd7](https://github.com/kuzzleio/kuzzle/commit/787cfd7a2e88a8c4cef339f920d0ade690020e06))
* **h5:** convert plugin.js and pluginsManager.js to TypeScript ([acb958e](https://github.com/kuzzleio/kuzzle/commit/acb958ea2b3a7d8321efb5c593a74562dfef8af7))
* **h6:** convert entryPoint.js and httpwsProtocol.js to TypeScript ([5d0ef6d](https://github.com/kuzzleio/kuzzle/commit/5d0ef6d6187183d97d31d9a3c6e0dc133c125606)), closes [#2749](https://github.com/kuzzleio/kuzzle/issues/2749)
* **i1:** convert the four lib/kuzzle leaves to TypeScript ([1990a22](https://github.com/kuzzleio/kuzzle/commit/1990a22b1e325752e69778677daaedf94117124f))
* **i2:** convert internalIndexHandler and dumpGenerator to TypeScript ([f7b9ff3](https://github.com/kuzzleio/kuzzle/commit/f7b9ff3847bf1dd75d7e11120a76dd74036f2c72))
* setup claude ([7de8020](https://github.com/kuzzleio/kuzzle/commit/7de80200f488d175d27898673da525ecb3637c0c))
* **skills:** add /wrapup skill for end-of-session handoff ([bc49d3a](https://github.com/kuzzleio/kuzzle/commit/bc49d3a1d2738b1d9f5934799e6b014342c60e71))
* **td-43:** charge for a type assertion — a sixth ratchet, `casts` ([3f8be8c](https://github.com/kuzzleio/kuzzle/commit/3f8be8c0a7c74f6d943131d7e134f0f1605b9b8b)), closes [#2730](https://github.com/kuzzleio/kuzzle/issues/2730)
* **td-56:** fail on a declaration that lies, adopted or not ([b415d7f](https://github.com/kuzzleio/kuzzle/commit/b415d7f39fa4e1eda9a5392c9eb4cd7bb77f65fd))
* **td-61:** make a conversion report the strict count it leaves behind ([e21fbf1](https://github.com/kuzzleio/kuzzle/commit/e21fbf16db3419421abb1a0639bddfd9c7cf32e1))
* **ts:** flip strict on, and split the test code into its own program ([e400320](https://github.com/kuzzleio/kuzzle/commit/e40032038435df95cc579b76de1f03e093a142ec))
* use new kuzzle vault algorithm ([dcea521](https://github.com/kuzzleio/kuzzle/commit/dcea521eb522062d39fba49c0b70fe60eeb5d9a8))
* **utils:** distributed reentrant mutex ([#2664](https://github.com/kuzzleio/kuzzle/issues/2664)) ([cda3514](https://github.com/kuzzleio/kuzzle/commit/cda3514b696717f361f55fdb5a2ac1ff06f9dd22))
* **vault:** use old encryption algorithm unless configured otherwise ([7eeec62](https://github.com/kuzzleio/kuzzle/commit/7eeec6298a35fa1c74b3289f3bba2cdbd6f525a2))

### Bug Fixes

* **api:** declare RateLimiter's limit without a dead initialiser ([0130222](https://github.com/kuzzleio/kuzzle/commit/0130222e45e21fa2104698471ead09e55ccfde46))
* **bin:** --enable-plugins skips a missing plugin with a warning (step 15, D-4) ([dfec664](https://github.com/kuzzleio/kuzzle/commit/dfec6642f6ec8d0389ef6f7431d8a7d608ebec38))
* **cache:** copy the Redis config with cloneDeep, not structuredClone (step 15, F-07) ([1702cb1](https://github.com/kuzzleio/kuzzle/commit/1702cb1cc9ee1292784a513f2c8a4494703c82fa)), closes [#2676](https://github.com/kuzzleio/kuzzle/issues/2676)
* **cache:** keep the receiver when calling a hoisted command ([b7b7234](https://github.com/kuzzleio/kuzzle/commit/b7b7234f4fd6de354c81c9a089e8031dc79e12ac))
* **changelog:** resolve leftover merge-conflict markers ([3ce76fc](https://github.com/kuzzleio/kuzzle/commit/3ce76fcf3b4691fd0ab3eec0e6b20da634cb7fd9))
* **ci:** anchor the strict-check adopted-path match ([622531a](https://github.com/kuzzleio/kuzzle/commit/622531a60da0f77ad129ca2f252c21937fa65045))
* **ci:** let the preflight conversion reminder see uncommitted work ([a72c6b1](https://github.com/kuzzleio/kuzzle/commit/a72c6b171c4c952faf28674b8846e40c0e473f5b)), closes [#2774](https://github.com/kuzzleio/kuzzle/issues/2774)
* **ci:** make the implicit-any and casts ratchets fail closed ([83f6601](https://github.com/kuzzleio/kuzzle/commit/83f6601810ab7d3bb9835de76c4ca69f24adf4b9)), closes [#2731](https://github.com/kuzzleio/kuzzle/issues/2731)
* **ci:** normalise the coverage reports before SonarCloud reads them ([d3870be](https://github.com/kuzzleio/kuzzle/commit/d3870be88ab35465820cb347cb04f3d5d3e5d209))
* **ci:** resolve .js targets in the tests/ mirror convention ([8c11613](https://github.com/kuzzleio/kuzzle/commit/8c116137a73c54709262105b255298ff56ff38df)), closes [#2771](https://github.com/kuzzleio/kuzzle/issues/2771)
* **ci:** restore coverage measurement on TypeScript (TD-24, [#2692](https://github.com/kuzzleio/kuzzle/issues/2692)) ([b90eac9](https://github.com/kuzzleio/kuzzle/commit/b90eac930c9128fe7f3833a72c2cac3072c164f5)), closes [#2658](https://github.com/kuzzleio/kuzzle/issues/2658)
* **ci:** stop the local docker unit runner rewriting the host's node_modules ([e8ae7af](https://github.com/kuzzleio/kuzzle/commit/e8ae7afd020f8d98412c805214c0af5b9d0fcfa4)), closes [#2793](https://github.com/kuzzleio/kuzzle/issues/2793) [#2790](https://github.com/kuzzleio/kuzzle/issues/2790)
* **ci:** wait-kuzzle's fourteenth call site, and the prune that removed its runner ([ff50dda](https://github.com/kuzzleio/kuzzle/commit/ff50dda837ca51e9598284bb5bab0ea617e96877))
* **cluster:** a joining node no longer evicts itself for a message it already has (step 15, F-12) ([cceefe8](https://github.com/kuzzleio/kuzzle/commit/cceefe85709a9a3a934774d6e269ca6183ed6d02)), closes [#2777](https://github.com/kuzzleio/kuzzle/issues/2777) [#2781](https://github.com/kuzzleio/kuzzle/issues/2781)
* **cluster:** answer a joining node's handshake within its timeout (step 15, F-03) ([5b4b8e9](https://github.com/kuzzleio/kuzzle/commit/5b4b8e91c21b92c0a6607fd065a2c33e13d52670)), closes [2777/#2781](https://github.com/2777/kuzzle/issues/2781)
* **cluster:** answer the rules node.ts's rename re-scored ([17ce162](https://github.com/kuzzleio/kuzzle/commit/17ce16219768b21aa0728d9b068cf14d0e8b75ba))
* **cluster:** answer the three rules the J3a rename re-scored ([e78f566](https://github.com/kuzzleio/kuzzle/commit/e78f5668f21c6c7d99c1e75b37575bfe5228c445))
* **cluster:** close TD-33's cluster half — TD-65 and TD-67 ([c753464](https://github.com/kuzzleio/kuzzle/commit/c753464fd2dfddb50ca4f2eea79929fb7141c572)), closes [#2773](https://github.com/kuzzleio/kuzzle/issues/2773) [#2776](https://github.com/kuzzleio/kuzzle/issues/2776)
* **cluster:** do not evict a peer for heartbeats queued behind a recovery (step 15, F-04) ([212183d](https://github.com/kuzzleio/kuzzle/commit/212183d84d5e9a5b586787c7742783acac044c3a)), closes [#2896](https://github.com/kuzzleio/kuzzle/issues/2896)
* **cluster:** fork the ID card worker by the extension it actually has ([690de4d](https://github.com/kuzzleio/kuzzle/commit/690de4d983461f74c66c777dcd8ffb1609f2ab44))
* **cluster:** inline SubscriberState, the last S6564 on the slice ([84d9a7c](https://github.com/kuzzleio/kuzzle/commit/84d9a7c08191b6cfe4380c1c24cc669946d00727))
* **cluster:** prove the subscription is live in addNode too ([f6def54](https://github.com/kuzzleio/kuzzle/commit/f6def54f03e42e18434e17239a871f88bdfb3114))
* **cluster:** satisfy the TS-only rules the subscriber rename exposed ([998e727](https://github.com/kuzzleio/kuzzle/commit/998e72704d4fb8fbae402dde7a8e20ebce9a831a))
* **cluster:** satisfy the two TS-only rules the rename exposed ([afae7af](https://github.com/kuzzleio/kuzzle/commit/afae7af1b51c6e597e02e7de3e627fd3fc62326c))
* **cluster:** shutdown before the handshake still disposes (step 15, F-11) ([ef882ef](https://github.com/kuzzleio/kuzzle/commit/ef882ef4377a00c24cbc9d6ecbffff8dd9d0ffa9)), closes [#2803](https://github.com/kuzzleio/kuzzle/issues/2803)
* **cluster:** the publisher's history is readonly ([fdb944e](https://github.com/kuzzleio/kuzzle/commit/fdb944efd65a31553d7649c41c3cf7827b305995))
* **cluster:** use Object.hasOwn in isSyncTopic ([0d56164](https://github.com/kuzzleio/kuzzle/commit/0d56164c674ff7d60d8542bc7575b0df9c30e0a7))
* **core:** a node that exits frees the locks it holds (step 15, F-13) ([6ab73f3](https://github.com/kuzzleio/kuzzle/commit/6ab73f33aefff53217b09d143bf50ca0642e4abb))
* **deps:** withLock on redis-semaphore, which supports Node 20 (step 15, D-3) ([6a2f9ae](https://github.com/kuzzleio/kuzzle/commit/6a2f9ae672b2fe80d7e89075f268424477616cab))
* **document:** export accepts an array sort (step 15, F-02) ([45c2966](https://github.com/kuzzleio/kuzzle/commit/45c2966de099097bff478d36a6f7200689cf8a38)), closes [#2666](https://github.com/kuzzleio/kuzzle/issues/2666)
* **dump:** check suffix against a regexp to sanitize user input ([#2665](https://github.com/kuzzleio/kuzzle/issues/2665)) ([79c9adf](https://github.com/kuzzleio/kuzzle/commit/79c9adf5bf0db6d21309ff68d4d5099e6a6306c7))
* **dump:** keep handled-error dumps valid and never unhandled (step 15, F-05) ([4356506](https://github.com/kuzzleio/kuzzle/commit/43565060f064a6861dca2ca7696346b9d8cb3539))
* **errors:** restore v2.56.0's client-facing text for plugin and WebSocket parsing errors (step 15, F-10) ([fdd0512](https://github.com/kuzzleio/kuzzle/commit/fdd051248e49ac51286fde0b3faa1e4a3fabfbcf)), closes [#2803](https://github.com/kuzzleio/kuzzle/issues/2803) [#2803](https://github.com/kuzzleio/kuzzle/issues/2803) [#2752](https://github.com/kuzzleio/kuzzle/issues/2752)
* **export-csv:** use sort args is provided in the query ([422ae64](https://github.com/kuzzleio/kuzzle/commit/422ae648941a658338719df02655e44d4aca22cf))
* **h5:** put the plugin config NOSONAR on the line Sonar flags ([525203b](https://github.com/kuzzleio/kuzzle/commit/525203b9a7508cfe9e41dd23ef40202156c02f01))
* **i1:** clear the five minor smells the renames re-scored ([e88ca2d](https://github.com/kuzzleio/kuzzle/commit/e88ca2d3c6fcc8944e36dc9348a8cf840fc1dd0a))
* **i2:** clear the five minor smells the renames re-scored ([ec07d91](https://github.com/kuzzleio/kuzzle/commit/ec07d9135fb305df4e285e29d7be48dd47a32edd)), closes [#2688](https://github.com/kuzzleio/kuzzle/issues/2688)
* **kerror:** drop the "probably not a Kuzzle error" suffix from plugin errors ([3b030e4](https://github.com/kuzzleio/kuzzle/commit/3b030e468327f3cd0318754fc41b662a5ebb16f6))
* **kerror:** only an object literal given last is the options object (step 15, F-08) ([3c8dbf1](https://github.com/kuzzleio/kuzzle/commit/3c8dbf12e6643097374afae34753ed25208ba336)), closes [#2803](https://github.com/kuzzleio/kuzzle/issues/2803)
* **kerror:** survive being loaded as ESM ([71b8c11](https://github.com/kuzzleio/kuzzle/commit/71b8c116de4205408ebdab184ca3686ce447d1e0))
* **kuzzle:** close TD-69 — the mappings-import lock race ([d37b391](https://github.com/kuzzleio/kuzzle/commit/d37b391171adffba6830316d4d44895ac75dfd94))
* **kuzzle:** flush the application logger on shutdown ([2730955](https://github.com/kuzzleio/kuzzle/commit/2730955bedd5724ce87ebd399ca9bf7d6d497f3b)), closes [#2747](https://github.com/kuzzleio/kuzzle/issues/2747)
* **kuzzle:** justify the deprecated Mutex on the import lock ([6af2921](https://github.com/kuzzleio/kuzzle/commit/6af2921c81ab3f54cad9b3d2c79ce6412c90e504)), closes [#2688](https://github.com/kuzzleio/kuzzle/issues/2688)
* **lint:** three unused/shadowed bindings left by K4 and K5 ([facf9c5](https://github.com/kuzzleio/kuzzle/commit/facf9c520acfbbe7bc937f9cd66a30be8547516e))
* **network:** enforce the multipart file-size limit and populate connection headers ([47c62cf](https://github.com/kuzzleio/kuzzle/commit/47c62cfabf1a679ce0fbc9db62b586e87c16f29d)), closes [#2749](https://github.com/kuzzleio/kuzzle/issues/2749)
* **network:** Protocol.init takes any falsy first argument again (step 15, F-11) ([0202c89](https://github.com/kuzzleio/kuzzle/commit/0202c89bba79c50f411d5ad08cb532d41ad2e6a3)), closes [#2737](https://github.com/kuzzleio/kuzzle/issues/2737)
* **plugin:** accessors.execute takes a null callback as absent (step 15, F-06) ([9a8d036](https://github.com/kuzzleio/kuzzle/commit/9a8d0365cf71e7690af10b1b9a6f7525f6d6b6c7)), closes [#2803](https://github.com/kuzzleio/kuzzle/issues/2803)
* **plugin:** strategy verify may return a then-only thenable (step 15, F-11) ([d89e323](https://github.com/kuzzleio/kuzzle/commit/d89e3238ebb1191d04fb51b19705931133bf3ea4)), closes [#2748](https://github.com/kuzzleio/kuzzle/issues/2748)
* **sonar:** clear the 27 new-code violations on the network rename ([b858fc2](https://github.com/kuzzleio/kuzzle/commit/b858fc22b5e222f0738ebe82a7be4dfb946ff2b1)), closes [#2688](https://github.com/kuzzleio/kuzzle/issues/2688) [#2722](https://github.com/kuzzleio/kuzzle/issues/2722)
* **sonar:** clear the 57 new-code minors the rename re-scored ([0b2ad1c](https://github.com/kuzzleio/kuzzle/commit/0b2ad1c455c5b2a738b09fe5080539c8f34a01f9))
* **sonar:** declare Profile._hash as an overloaded method, not a static field ([ffca3db](https://github.com/kuzzleio/kuzzle/commit/ffca3dbd9cb38f3a040f233277018ee13c87c14c))
* **sonar:** NOSONAR the two remaining awaits of a non-Promise (TD-26) ([85a22fc](https://github.com/kuzzleio/kuzzle/commit/85a22fc5d5c59c4659dbff561ff58d0bf4cd19f1)), closes [#2697](https://github.com/kuzzleio/kuzzle/issues/2697)
* **sonar:** optional chaining in documentController + CPD-exclude the file ([899f73f](https://github.com/kuzzleio/kuzzle/commit/899f73f3bb78c1a4affe6391d260dc7a643b51c2))
* **sonar:** resolve new-code smells in memoryStorageController (PR C) ([1ea5437](https://github.com/kuzzleio/kuzzle/commit/1ea543732d29dc6e5a1541689d79471697b9c226))
* **sonar:** resolve new-code smells in serverController + documentExtractor (PR D) ([1d423e5](https://github.com/kuzzleio/kuzzle/commit/1d423e5265563b5bd34661cda1a675fedb900147))
* **sonar:** resolve the new-code smells the rename re-scored (PR G1) ([d96f77f](https://github.com/kuzzleio/kuzzle/commit/d96f77f52f9b3f9c3770f86fe56f9f76515c41d5))
* **sonar:** resolve the smells the clientAdapter rename re-scored ([5eee56f](https://github.com/kuzzleio/kuzzle/commit/5eee56f925a4976d92c53a5c755b141afcc1e570)), closes [#2688](https://github.com/kuzzleio/kuzzle/issues/2688)
* **sonar:** resolve the three smells the typing pass scored ([f396617](https://github.com/kuzzleio/kuzzle/commit/f396617f76edaab5b1f0997df9bd8f7229ebefbe))
* **sonar:** return null rather than Promise.resolve(null) in load() ([4c456e1](https://github.com/kuzzleio/kuzzle/commit/4c456e19ab02be9035a76f0888b4e79f632ee98f))
* **sonar:** split the four functions the rename re-scored as too complex ([0efbea0](https://github.com/kuzzleio/kuzzle/commit/0efbea00b4ec80d623dfe6f872a69b63f68872cf))
* **sonar:** the last new-code minor on accessLogger ([e72a829](https://github.com/kuzzleio/kuzzle/commit/e72a829e8cddffe09b6bc823b7f50b811b8ec0d3))
* **sonar:** the last three new-code minors on geoShape ([4be97a0](https://github.com/kuzzleio/kuzzle/commit/4be97a0a7a6a25342acbbd0769a3821cd6e72dbb))
* **step-03:** bin/start-kuzzle-server, whose every option was dead ([7006066](https://github.com/kuzzleio/kuzzle/commit/700606662ce5fd0b3221c7dc69206003fec3a5ab))
* **step-14:** M7 — ts-node reads the test program's options, not its include ([2b6d4e5](https://github.com/kuzzleio/kuzzle/commit/2b6d4e5734e6d44ead79eae00d1fe88058943763))
* **storage:** a missing document answers not_found again (step 15, F-01) ([2ad3541](https://github.com/kuzzleio/kuzzle/commit/2ad3541e3013eb9416b6050f4a3fabe371f9da8c))
* **td-20:** configure takes a result, and the core stops calling setResult ([5824f88](https://github.com/kuzzleio/kuzzle/commit/5824f88ef83aeeb8f8f849dd6fe857eefe240cbe))
* **td-20:** name the comma-separated array form instead of deprecating it ([6e17100](https://github.com/kuzzleio/kuzzle/commit/6e17100bc2d8b1cfcfb6701e303d1ed9b8d232c8)), closes [#2721](https://github.com/kuzzleio/kuzzle/issues/2721)
* **td-20:** validation reads input.args instead of the deprecated input.resource ([7ae3126](https://github.com/kuzzleio/kuzzle/commit/7ae312669d517d32f032de94c09a62a34e436df9))
* **td-21:** guard _wrapError on the controller name, not the request ([65a9e09](https://github.com/kuzzleio/kuzzle/commit/65a9e098799d722cf2681992199366081334e133)), closes [#2687](https://github.com/kuzzleio/kuzzle/issues/2687)
* **td-26:** drop the five awaits of a non-Promise ([914341a](https://github.com/kuzzleio/kuzzle/commit/914341a314cddba37f6c90c9a1eaf06cca420bde)), closes [#2697](https://github.com/kuzzleio/kuzzle/issues/2697)
* **td-27:** normalize a controller's error where it is raised, not on the funnel ([563b183](https://github.com/kuzzleio/kuzzle/commit/563b183ff3752589a8cf92e31168df3744f95df7)), closes [#2703](https://github.com/kuzzleio/kuzzle/issues/2703)
* **td-28:** drop memoryStorageController's class-wide index signature ([4687d74](https://github.com/kuzzleio/kuzzle/commit/4687d74820563605c6e466f42c9996ba3340cd60)), closes [#2702](https://github.com/kuzzleio/kuzzle/issues/2702) [#2704](https://github.com/kuzzleio/kuzzle/issues/2704)
* **td-33:** gate the functional suite on cluster readiness, not on a handshake ([267f9d3](https://github.com/kuzzleio/kuzzle/commit/267f9d3722f58188746809a65a9c9c9ffcdd4a2d)), closes [#2715](https://github.com/kuzzleio/kuzzle/issues/2715)
* **td-33:** keep the log dump armed through the test run ([f63f997](https://github.com/kuzzleio/kuzzle/commit/f63f997773dcd336d769b89b6087259b053b9c51))
* **td-33:** make a cluster startup failure diagnose itself ([ad9fe4b](https://github.com/kuzzleio/kuzzle/commit/ad9fe4ba8c77dcd7d759579bc53f71c40d613663))
* **td-33:** put fail-fast: false on the monkey matrix too ([7ae01af](https://github.com/kuzzleio/kuzzle/commit/7ae01af5297a5f0b8c127d91b7606e2ee01ebb87))
* **td-34:** correct Profile._hash's return type, and type its patch site ([a802d4a](https://github.com/kuzzleio/kuzzle/commit/a802d4a3663bc55622a1b87ff409bf2481716a40)), closes [#2712](https://github.com/kuzzleio/kuzzle/issues/2712) [#2712](https://github.com/kuzzleio/kuzzle/issues/2712)
* **td-35:** run copy-binaries without a native binary, and gate the build payload ([389c2a0](https://github.com/kuzzleio/kuzzle/commit/389c2a07d7f661ea4805ca265963ff9007cd4f77)), closes [#2713](https://github.com/kuzzleio/kuzzle/issues/2713)
* **td-36,td-37:** gate the artifact that is published, and derive the gate from `files` ([6fbb0ec](https://github.com/kuzzleio/kuzzle/commit/6fbb0ecd8bf7218a914facac752f0aac5e37945a)), closes [#2717](https://github.com/kuzzleio/kuzzle/issues/2717)
* **td-38,td-47:** gate a fork's PR on the build, and stop paying for superseded runs ([86e309d](https://github.com/kuzzleio/kuzzle/commit/86e309dfe36dfc9678451957fb25def55dfcc48b)), closes [#2719](https://github.com/kuzzleio/kuzzle/issues/2719) [#2725](https://github.com/kuzzleio/kuzzle/issues/2725) [#2734](https://github.com/kuzzleio/kuzzle/issues/2734)
* **td-40:** declare the load path nullable, where it has always been nullable ([e08e9fd](https://github.com/kuzzleio/kuzzle/commit/e08e9fdeb931a4698f3ca01a16239e869b74d0f1)), closes [#2724](https://github.com/kuzzleio/kuzzle/issues/2724) [#2727](https://github.com/kuzzleio/kuzzle/issues/2727)
* **td-41:** give Protocol.init the two overloads its union was standing in for ([859d162](https://github.com/kuzzleio/kuzzle/commit/859d16259d0501d1be59d886d908a6dba29cdf97)), closes [#1645](https://github.com/kuzzleio/kuzzle/issues/1645) [#2728](https://github.com/kuzzleio/kuzzle/issues/2728)
* **td-41:** normalise the entry point with `??` instead of a null ternary ([17e7ec1](https://github.com/kuzzleio/kuzzle/commit/17e7ec174d195a1a62162c3f6891dc0be4c2da61))
* **td-42:** hold the coverage rule per converted file, not per block ([1c1bd58](https://github.com/kuzzleio/kuzzle/commit/1c1bd58d19f09fa1d9c25c6c96adc99145e22a6e)), closes [#2724](https://github.com/kuzzleio/kuzzle/issues/2724) [#2723](https://github.com/kuzzleio/kuzzle/issues/2723) [#2723](https://github.com/kuzzleio/kuzzle/issues/2723)
* **td-43:** keep `node:` on the import the autofix split in two ([0affee9](https://github.com/kuzzleio/kuzzle/commit/0affee90577bafd8dc9fecea2405b8f74619ad37))
* **td-43:** make type-only imports explicit, repo-wide ([ddf66ac](https://github.com/kuzzleio/kuzzle/commit/ddf66ac693f31dd8253adb5b160d847919780e57))
* **td-44:** make the strict check fail closed when tsc does not run ([2059381](https://github.com/kuzzleio/kuzzle/commit/2059381413b5fc4f638b65576a4f2c820f0f6af2)), closes [#2731](https://github.com/kuzzleio/kuzzle/issues/2731)
* **td-45:** count extensionless Node executables in the js ratchet ([f59a6a6](https://github.com/kuzzleio/kuzzle/commit/f59a6a628c7e41bbc6af7129937b4eb0b4ba199d)), closes [#2719](https://github.com/kuzzleio/kuzzle/issues/2719) [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) [#2732](https://github.com/kuzzleio/kuzzle/issues/2732)
* **td-46:** stop asserting an assignment to a stub the spec declared itself ([100f6e2](https://github.com/kuzzleio/kuzzle/commit/100f6e24e1090911fe18a9087102d7a49e9d8899)), closes [#2739](https://github.com/kuzzleio/kuzzle/issues/2739)
* **td-48:** assert that a stack trace never leaves the process ([f8b3b06](https://github.com/kuzzleio/kuzzle/commit/f8b3b0626b32b3d03f3f5386603dead64d4cf10f))
* **td-48:** keep the production node out of the cluster ([548bc48](https://github.com/kuzzleio/kuzzle/commit/548bc488d28e79cc7331b94f60dd093f962aeaaf))
* **td-49:** let the vitest tree load what reaches lib/api/controllers ([6c19eaa](https://github.com/kuzzleio/kuzzle/commit/6c19eaa1db4d1d52930ca1d8a8e3fc3129f0b9d5))
* **td-50:** merge coverage as istanbul, not as V8 ranges ([6f095ed](https://github.com/kuzzleio/kuzzle/commit/6f095ed2c5d69e66f4ba18548791af2b467d658a)), closes [#2744](https://github.com/kuzzleio/kuzzle/issues/2744)
* **td-55:** make waterfall ask the chain, not the value ([596a0f0](https://github.com/kuzzleio/kuzzle/commit/596a0f0127d33b927603e16aa44f90881d6fe52f))
* **td-56:** stop bindPluginMethod declaring a type it does not return ([818cb0d](https://github.com/kuzzleio/kuzzle/commit/818cb0d0e048b3a3ba32ba6f3632b21b7b080114)), closes [#2757](https://github.com/kuzzleio/kuzzle/issues/2757)
* **td-57:** type vault's remembered key honestly, and test it ([4603d30](https://github.com/kuzzleio/kuzzle/commit/4603d306d224b9999a15a1c823db8f23d7152f00))
* **td-58:** count the messages that were actually lost ([910bc9a](https://github.com/kuzzleio/kuzzle/commit/910bc9a7f6ec00ec30e6559de4134ece712f58b7)), closes [#2715](https://github.com/kuzzleio/kuzzle/issues/2715)
* **td-58:** subtract message ids with Long, not with `-` ([a3091ec](https://github.com/kuzzleio/kuzzle/commit/a3091ecbf87930ab29377454aa1420f6a40dbb51))
* **td-59:** give the cluster the id the process logs under ([191a4e7](https://github.com/kuzzleio/kuzzle/commit/191a4e7995d4f980af18dd9193bad4d0bb6420d9)), closes [#2757](https://github.com/kuzzleio/kuzzle/issues/2757)
* **td-59:** print both node ids when joining the cluster ([d7805c1](https://github.com/kuzzleio/kuzzle/commit/d7805c12b57830e430543a7c22d57e68fffbea67)), closes [#2764](https://github.com/kuzzleio/kuzzle/issues/2764)
* **td-74:** the allowed-values statics are readonly ([643d70b](https://github.com/kuzzleio/kuzzle/commit/643d70b110817e47d6a8f5879b2c4e0d224b34f3))
* **td-74:** users "out" and "none" no longer share a channel name ([324a6c4](https://github.com/kuzzleio/kuzzle/commit/324a6c4118cbbfcaa3f9037a324d2c6f864f16da))
* **td-75:** the date type's specification has a type of its own ([53dec89](https://github.com/kuzzleio/kuzzle/commit/53dec8992d73a9ce239877fbb1f0bb8d8f31b3d1))
* **td-76:** declare PluginContext.constructors as constructors ([6d37959](https://github.com/kuzzleio/kuzzle/commit/6d3795952f493f4aab9f6b0339286ca90186aa03))
* **td-77:** remove the two invalid_openapi_schema codes nothing raises ([c8cbc1d](https://github.com/kuzzleio/kuzzle/commit/c8cbc1d25d11d9fc921bc747286872840fac55ce))
* **td-78:** the plugin hook and pipe types admit every form the runtime takes ([41c519e](https://github.com/kuzzleio/kuzzle/commit/41c519ecfd56f0183f3e1fbc66ca63b46cf275c1))
* **td-79:** two config checker messages now say what they check ([f3fdc72](https://github.com/kuzzleio/kuzzle/commit/f3fdc72b2f92c8b24d299d51a830c8fa2f1984aa))
* **td-80:** give passport its `next`, and route every failure through one path ([9443c5b](https://github.com/kuzzleio/kuzzle/commit/9443c5b882bb51c98f00503cc915f7ee9deb4045))
* **td-81:** release the dump lock on every path, and check arguments before taking it ([52932f0](https://github.com/kuzzleio/kuzzle/commit/52932f089a7250dc36fc269d09ddb4b9e634e386))
* **test:** point cucumber's ts-node at the test program ([28828af](https://github.com/kuzzleio/kuzzle/commit/28828af1675685ac3c68e671f28a5bc123515aa4))
* **tests:** close TD-70 — stop pinning the order of an unordered search ([c50751b](https://github.com/kuzzleio/kuzzle/commit/c50751b08eb495da205f63d680ac6cad747bebc5)), closes [#2783](https://github.com/kuzzleio/kuzzle/issues/2783)
* **ts-migration:** put the NOSONAR marker on the flagged line ([66449cb](https://github.com/kuzzleio/kuzzle/commit/66449cbe8a9d504e131b16d87d2dbbfb1d2f8b56))
* **ts-migration:** restore the receiver on dynamic cache-script calls ([f68aaf4](https://github.com/kuzzleio/kuzzle/commit/f68aaf41690906d353333baae69e4580ff013b2c))
* **types:** authController — step 12, K5 ([7363d25](https://github.com/kuzzleio/kuzzle/commit/7363d2520b3eb99d2a59389cd2af5209854ef6bc))
* **types:** configuration, controllers, generic events and repositories compile as against v2.56.0 (step 15, TY-04/07) ([afcb08d](https://github.com/kuzzleio/kuzzle/commit/afcb08d1a5ec09f71221900bc2cef956e5c90670))
* **types:** declare accessors.execute's callback form as v2.56.0 did ([96f1fc8](https://github.com/kuzzleio/kuzzle/commit/96f1fc831521c180a27e4baaa01b6b4f59e063cb))
* **types:** deprecate Token.connectionId, which no runtime token carries (ADR-0002, TD-07) ([4a04dc5](https://github.com/kuzzleio/kuzzle/commit/4a04dc5e466abc242f7750cf0f6749eab19f3a55))
* **types:** ES7 storage service is strict-clean and adopted — step 12, K3 ([329692f](https://github.com/kuzzleio/kuzzle/commit/329692fe15739dad2ac4fb4abefa8e4779db9ace))
* **types:** ES8 storage service is strict-clean and adopted — step 12, K3 ([9d80753](https://github.com/kuzzleio/kuzzle/commit/9d80753d33a5f047c922c2cb86e179e8228bdb06))
* **types:** export public types missing from the types barrel ([3dbb530](https://github.com/kuzzleio/kuzzle/commit/3dbb530fa5152d3c5767859884654a61cb97cddc))
* **types:** fix triple-l typo in adminController type filename ([e733094](https://github.com/kuzzleio/kuzzle/commit/e733094782ef4526766459f0de0a41e8d8728635))
* **types:** funnel — step 12, K5 ([5a4cc05](https://github.com/kuzzleio/kuzzle/commit/5a4cc05ac77cf7a0441ce0b454ca85b9db37dc49))
* **types:** kerror — step 12, K5 ([1ee1d0a](https://github.com/kuzzleio/kuzzle/commit/1ee1d0af29250fbaf59d2729ee498796d56bff9f))
* **types:** let Error stringify a non-string KuzzleError message itself ([f611ac8](https://github.com/kuzzleio/kuzzle/commit/f611ac8b07d938e0ad0ed2577f18fee9b5b555dc))
* **types:** lib/core/network and the manifests — step 12, K5 ([d8d8826](https://github.com/kuzzleio/kuzzle/commit/d8d8826a273fb8ade8511bdd18e3c5a35baa19aa))
* **types:** lib/kuzzle — step 12, K5 ([1271750](https://github.com/kuzzleio/kuzzle/commit/1271750a5f5fc25058782810239b11bc66bd072c))
* **types:** make lib/api/request strict-clean — step 12, K2 ([a1eaab0](https://github.com/kuzzleio/kuzzle/commit/a1eaab01a5041a82bf985a32155037ae5fab732a))
* **types:** make lib/kerror's error classes strict-clean — step 12, K1 ([7ebad7d](https://github.com/kuzzleio/kuzzle/commit/7ebad7d5f2f5e1e34dc39db3386d46ea499f1427))
* **types:** make lib/types' small files and baseModel strict-clean — step 12, K1 ([1b9eea5](https://github.com/kuzzleio/kuzzle/commit/1b9eea5a098d10164c8d7700017c49ca8eee41f7))
* **types:** make lib/util's small files strict-clean — step 12, K1 ([3978f0c](https://github.com/kuzzleio/kuzzle/commit/3978f0c210ea87d093677e2f6be7d6601e235510))
* **types:** make nine lib/core files strict-clean — step 12, K1 ([cb1db7e](https://github.com/kuzzleio/kuzzle/commit/cb1db7ed443105722cbce70c73141694a65517f4))
* **types:** make the last fifteen ≤ 5 files strict-clean — step 12, K1 ([2bbafeb](https://github.com/kuzzleio/kuzzle/commit/2bbafebf416a586e19c2a98b459dc7a4550da00a))
* **types:** memoryStorageController and the body assertion — step 12, K5 ([60a7dce](https://github.com/kuzzleio/kuzzle/commit/60a7dce00855727bfd1a8d98ee57e1ea2c743e89))
* **types:** plugin context, accessors.execute and errors compile as against v2.56.0 (step 15, TY-01/02/05) ([0ad75fa](https://github.com/kuzzleio/kuzzle/commit/0ad75faa6c543370dd20c1dbeb933a1f34af7498))
* **types:** plugin.ts, hotelClerk.ts and subscription.ts — step 12, K4 ([d37aeac](https://github.com/kuzzleio/kuzzle/commit/d37aeac5791548de870f54fe83aca03b82ae0a3d))
* **types:** pluginContext, Backend and the debugger — step 12, K5 ([f778842](https://github.com/kuzzleio/kuzzle/commit/f7788423a83ac1f75030d6023ceb108e9c6c343d))
* **types:** pluginsManager — step 12, K4 ([27e4c6a](https://github.com/kuzzleio/kuzzle/commit/27e4c6ada9cf740d3e9108b30b73310c9e13e5ed))
* **types:** point Validation.validate JSDoc at KuzzleRequest ([d0484ab](https://github.com/kuzzleio/kuzzle/commit/d0484ab6912f2ebc1670d2265de8a3ce09f55eb1))
* **types:** queryTranslator and the redis adapter — step 12, K5 ([94469d7](https://github.com/kuzzleio/kuzzle/commit/94469d727bfc756cc744cbb1a18df2c5e66e797d))
* **types:** read the deprecated jwt section through one documented helper ([063fb76](https://github.com/kuzzleio/kuzzle/commit/063fb7649301a25cece93618cfa414d7cbce2a11))
* **types:** request getters, user and token read as against v2.56.0 (step 15, TY-03/06) ([fb4f550](https://github.com/kuzzleio/kuzzle/commit/fb4f550d853486ff7d0f4c6118cf424aac638b50)), closes [#2801](https://github.com/kuzzleio/kuzzle/issues/2801) [#2803](https://github.com/kuzzleio/kuzzle/issues/2803)
* **types:** split the three configuration shapes — step 12, K0 (TD-53) ([8b51997](https://github.com/kuzzleio/kuzzle/commit/8b51997ee9570e45c6c0d16b535e71b74aaa8c78))
* **types:** stop NativeController.constructor inferring never[] ([66e3ddc](https://github.com/kuzzleio/kuzzle/commit/66e3ddccd9bdbee648008e8aacbe9d2012a4ec9b))
* **types:** TD-62's model/security half and the repositories it moves into ([c07ad0f](https://github.com/kuzzleio/kuzzle/commit/c07ad0f95ad0e4ea4acddf01710e6838d1713406))
* **types:** the cluster — step 12, K5 ([20ced7f](https://github.com/kuzzleio/kuzzle/commit/20ced7f09b24ad517b4fd4e47970dee6b59ef172))
* **types:** the last of lib/ — step 12, K5 ([aa5f4c2](https://github.com/kuzzleio/kuzzle/commit/aa5f4c2fb6b1a7dc5d43bfb5d74566892ff46d6b))
* **types:** the protocol stack — step 12, K4 ([1058067](https://github.com/kuzzleio/kuzzle/commit/1058067253e77ed56af1c3648011fa515ce638ae))
* **types:** the remaining controllers and documentExtractor — step 12, K5 ([3647a19](https://github.com/kuzzleio/kuzzle/commit/3647a192cd4b98dcc9626df27546d10a6046f254))
* **types:** the remaining declarations accept what v2.56.0's did (step 15, TY residuals) ([20f7a80](https://github.com/kuzzleio/kuzzle/commit/20f7a8032dab57a8ccfea963cde11bf76c15818b))
* **types:** the token pair — step 12, K4 ([e7614a3](https://github.com/kuzzleio/kuzzle/commit/e7614a3dbacc47786dbe4c16ea8a1af15397e960))
* **types:** the two base classes and validation.ts — step 12, K4 (part 1) ([664d3e0](https://github.com/kuzzleio/kuzzle/commit/664d3e0d03c13339d1ce775064fd4e5b11d4a719))
* **util:** model Promback's settled value as `T | undefined` ([5f8e751](https://github.com/kuzzleio/kuzzle/commit/5f8e7516e99c0aead43fec0262f7fd74808214fb))
* **validation:** a truthy non-boolean collection `strict` is strict again (step 15, F-09b) ([377c9f0](https://github.com/kuzzleio/kuzzle/commit/377c9f06da95499336c9cd06eb2ac4372f29377f)), closes [#2803](https://github.com/kuzzleio/kuzzle/issues/2803)
* **validation:** let plugin types provide BaseType members as getters or prototype values (step 15, F-09a) ([5eb24ba](https://github.com/kuzzleio/kuzzle/commit/5eb24bab82477de61dbeb098e6987d9934041eea)), closes [#2722](https://github.com/kuzzleio/kuzzle/issues/2722)
* **validation:** use ??= in the helper the move made new code ([02cfdfe](https://github.com/kuzzleio/kuzzle/commit/02cfdfecd0ee4ac448fa9f7dc49467cec309874f))

## [2.56.0](https://github.com/kuzzleio/kuzzle/compare/v2.55.0...v2.56.0) (2026-06-23)

### Features

* **csv-export:** added support for collapse ([cbc0aee](https://github.com/kuzzleio/kuzzle/commit/cbc0aeee5378b3c0dd8a7bd797a6208da0aecd20))

### Bug Fixes

* codex reported issues ([99d3dad](https://github.com/kuzzleio/kuzzle/commit/99d3dadd947868b9ea3fbfb1a31cc55e159fabef))
* **documentController:** fixing collapse property missing a default value ([de812a8](https://github.com/kuzzleio/kuzzle/commit/de812a82831ea8bf2a637d7ef744b19b055831f1))
* kuzzle imports indices was not properly following defaultSettings ([e128a3c](https://github.com/kuzzleio/kuzzle/commit/e128a3c40de592ee99e6f937e87bf14bc0ba6e73))

## [2.56.0-beta.3](https://github.com/kuzzleio/kuzzle/compare/v2.56.0-beta.2...v2.56.0-beta.3) (2026-06-23)

### Bug Fixes

* **documentController:** fixing collapse property missing a default value ([de812a8](https://github.com/kuzzleio/kuzzle/commit/de812a82831ea8bf2a637d7ef744b19b055831f1))

## [2.56.0-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.56.0-beta.1...v2.56.0-beta.2) (2026-06-23)

### Bug Fixes

* codex reported issues ([99d3dad](https://github.com/kuzzleio/kuzzle/commit/99d3dadd947868b9ea3fbfb1a31cc55e159fabef))

## [2.56.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.55.0...v2.56.0-beta.1) (2026-06-23)

### Features

* **csv-export:** added support for collapse ([cbc0aee](https://github.com/kuzzleio/kuzzle/commit/cbc0aeee5378b3c0dd8a7bd797a6208da0aecd20))

### Bug Fixes

* kuzzle imports indices was not properly following defaultSettings ([e128a3c](https://github.com/kuzzleio/kuzzle/commit/e128a3c40de592ee99e6f937e87bf14bc0ba6e73))

## [2.55.0](https://github.com/kuzzleio/kuzzle/compare/v2.54.4...v2.55.0) (2026-05-20)

### Features

* **security:** add restrictDefaultRights endpoint ([#2657](https://github.com/kuzzleio/kuzzle/issues/2657)) ([e1df33a](https://github.com/kuzzleio/kuzzle/commit/e1df33a3919ade1dc1fa66418b1bdec71a935415))

## [2.54.4](https://github.com/kuzzleio/kuzzle/compare/v2.54.3...v2.54.4) (2026-04-29)

### Bug Fixes

* dockerfile cmd issue ([795e7dc](https://github.com/kuzzleio/kuzzle/commit/795e7dc168ccdf4f584d7a1d78fdc0e26eba9858))

## [2.54.3](https://github.com/kuzzleio/kuzzle/compare/v2.54.2...v2.54.3) (2026-04-22)

### Bug Fixes

* copy binaries ([bb04618](https://github.com/kuzzleio/kuzzle/commit/bb04618d1fbe75236bc9ea30f159170553289be2))

## [2.54.2](https://github.com/kuzzleio/kuzzle/compare/v2.54.1...v2.54.2) (2026-04-22)

### Bug Fixes

* add proper permission to start-kuzzle-server file ([2afe3b7](https://github.com/kuzzleio/kuzzle/commit/2afe3b7377584905b1f469aa7216de023f82e269))

## [2.54.1](https://github.com/kuzzleio/kuzzle/compare/v2.54.0...v2.54.1) (2026-04-22)

### Bug Fixes

* missing start-kuzzle-server file in published artefact ([99a1088](https://github.com/kuzzleio/kuzzle/commit/99a1088c147a8fbaac5093bbb8907e977a8b2468))

## [2.54.0](https://github.com/kuzzleio/kuzzle/compare/v2.53.0...v2.54.0) (2026-04-21)

### Features

* use github app token when releasing a new version ([9f24eb5](https://github.com/kuzzleio/kuzzle/commit/9f24eb5b4b575500c790e14b94a14b5333010be9))

### Bug Fixes

* issue with cleanup ([fb29e97](https://github.com/kuzzleio/kuzzle/commit/fb29e978f4eb83973c85906f6f8f23feafd4f4ea))
* **requestInput:** body type ([#2654](https://github.com/kuzzleio/kuzzle/issues/2654)) ([b3cc5f1](https://github.com/kuzzleio/kuzzle/commit/b3cc5f175cd0cf6d15d0802c77187bf5d2eaf422))

## [2.54.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.53.0...v2.54.0-beta.1) (2026-04-21)

### Features

* use github app token when releasing a new version ([9f24eb5](https://github.com/kuzzleio/kuzzle/commit/9f24eb5b4b575500c790e14b94a14b5333010be9))

### Bug Fixes

* issue with cleanup ([fb29e97](https://github.com/kuzzleio/kuzzle/commit/fb29e978f4eb83973c85906f6f8f23feafd4f4ea))
* **requestInput:** body type ([#2654](https://github.com/kuzzleio/kuzzle/issues/2654)) ([b3cc5f1](https://github.com/kuzzleio/kuzzle/commit/b3cc5f175cd0cf6d15d0802c77187bf5d2eaf422))

## [2.53.0](https://github.com/kuzzleio/kuzzle/compare/v2.52.0...v2.53.0) (2026-03-02)

### Features

* **requestInput:** allow to receive array request body ([#2648](https://github.com/kuzzleio/kuzzle/issues/2648)) ([4cefbdc](https://github.com/kuzzleio/kuzzle/commit/4cefbdcd62828d63a255ea2f6dd3da347b3cc14a))

### Bug Fixes

* **dumpGenerator:** throw if dump path outside of the configured dump folder ([#2647](https://github.com/kuzzleio/kuzzle/issues/2647)) ([6b343d9](https://github.com/kuzzleio/kuzzle/commit/6b343d96cfc659609ff465b5b60959ab7bccfc72))

## [2.53.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.52.0...v2.53.0-beta.1) (2026-01-29)

### Features

* **requestInput:** allow to receive array request body ([#2648](https://github.com/kuzzleio/kuzzle/issues/2648)) ([4cefbdc](https://github.com/kuzzleio/kuzzle/commit/4cefbdcd62828d63a255ea2f6dd3da347b3cc14a))

### Bug Fixes

* **dumpGenerator:** throw if dump path outside of the configured dump folder ([#2647](https://github.com/kuzzleio/kuzzle/issues/2647)) ([6b343d9](https://github.com/kuzzleio/kuzzle/commit/6b343d96cfc659609ff465b5b60959ab7bccfc72))

## [2.52.0](https://github.com/kuzzleio/kuzzle/compare/v2.51.0...v2.52.0) (2026-01-16)

### Features

* expiresin property in refresh token when a strategy is specified ([b11584f](https://github.com/kuzzleio/kuzzle/commit/b11584fb59df195e18be09fe68e67e302f567198))

## [2.52.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.51.0...v2.52.0-beta.1) (2026-01-16)

### Features

* expiresin property in refresh token when a strategy is specified ([b11584f](https://github.com/kuzzleio/kuzzle/commit/b11584fb59df195e18be09fe68e67e302f567198))

## [2.51.0](https://github.com/kuzzleio/kuzzle/compare/v2.50.3...v2.51.0) (2026-01-09)

### Features

* add strategy handling for refreshtoken in the auth controller ([9c2a34f](https://github.com/kuzzleio/kuzzle/commit/9c2a34f7d0de00c97901f6cd7ee38fb053c67f4d))

## [2.51.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.50.3...v2.51.0-beta.1) (2026-01-09)

### Features

* add strategy handling for refreshtoken in the auth controller ([9c2a34f](https://github.com/kuzzleio/kuzzle/commit/9c2a34f7d0de00c97901f6cd7ee38fb053c67f4d))

## [2.50.3](https://github.com/kuzzleio/kuzzle/compare/v2.50.2...v2.50.3) (2026-01-02)

### Bug Fixes

* user.isActionAllowed now await properly ([0045fe4](https://github.com/kuzzleio/kuzzle/commit/0045fe42d784e946bf5db7c7268ee507b28ba566))

## [2.50.2](https://github.com/kuzzleio/kuzzle/compare/v2.50.1...v2.50.2) (2026-01-02)

### Bug Fixes

* user.isActionAllowed in hotel clerc ([fa71948](https://github.com/kuzzleio/kuzzle/commit/fa719486ddb2473ca64cbf4cd0b75a10d2a08bd9))

## [2.50.1](https://github.com/kuzzleio/kuzzle/compare/v2.50.0...v2.50.1) (2026-01-02)

### Bug Fixes

* an issue with user typings ([ebef54a](https://github.com/kuzzleio/kuzzle/commit/ebef54a6dc019f48ec3eab3a0fcb70022fe18825))
* await a to isActionAllowed ([dafc313](https://github.com/kuzzleio/kuzzle/commit/dafc31363cdf000a02c2829b0b249e4d0cb40af6))
* conflicting user class between kuzzle and sdk-javascript ([ee92777](https://github.com/kuzzleio/kuzzle/commit/ee92777326b90ff0b83bf8da7420d3ba875bb5ca))
* import with new version of sdk ([0622b77](https://github.com/kuzzleio/kuzzle/commit/0622b7710504e04fe99297ce0be1ef02d17cf779))
* keep the await at boudfunction ([8f83127](https://github.com/kuzzleio/kuzzle/commit/8f83127e439919c667a451746323f0789ece5f7d))

## [2.50.1-beta.3](https://github.com/kuzzleio/kuzzle/compare/v2.50.1-beta.2...v2.50.1-beta.3) (2026-01-02)

### Bug Fixes

* await a to isActionAllowed ([dafc313](https://github.com/kuzzleio/kuzzle/commit/dafc31363cdf000a02c2829b0b249e4d0cb40af6))

## [2.50.1-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.50.1-beta.1...v2.50.1-beta.2) (2026-01-02)

### Bug Fixes

* an issue with user typings ([ebef54a](https://github.com/kuzzleio/kuzzle/commit/ebef54a6dc019f48ec3eab3a0fcb70022fe18825))
* conflicting user class between kuzzle and sdk-javascript ([ee92777](https://github.com/kuzzleio/kuzzle/commit/ee92777326b90ff0b83bf8da7420d3ba875bb5ca))

## [2.50.1-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.50.0...v2.50.1-beta.1) (2026-01-02)

### Bug Fixes

* import with new version of sdk ([0622b77](https://github.com/kuzzleio/kuzzle/commit/0622b7710504e04fe99297ce0be1ef02d17cf779))
* keep the await at boudfunction ([8f83127](https://github.com/kuzzleio/kuzzle/commit/8f83127e439919c667a451746323f0789ece5f7d))

## [2.50.0](https://github.com/kuzzleio/kuzzle/compare/v2.49.1...v2.50.0) (2025-12-18)

### Features

* bump deps ([b796f0b](https://github.com/kuzzleio/kuzzle/commit/b796f0bd214667b3e18cf4bbe36c0ce4e1f68b43))
* nodejs 24 in actions ([723488c](https://github.com/kuzzleio/kuzzle/commit/723488c1c4f7647c46cbd26ba82a71952ccbba9e))
* nodejs 24 support ([f420b17](https://github.com/kuzzleio/kuzzle/commit/f420b171e8dab9afcbf57f2ca732d90ef4b1f99b))
* typescript updates ([a8256ca](https://github.com/kuzzleio/kuzzle/commit/a8256ca0b3e0790ae72ccbf4a2bc5cdd56d76b23))

### Bug Fixes

* _id sort on searchRoles not allowed with es8 ([f8d5c3e](https://github.com/kuzzleio/kuzzle/commit/f8d5c3e0a06870be3f65a083c077cb668c0e5da3))
* add main and types entries in packa ([4f8be51](https://github.com/kuzzleio/kuzzle/commit/4f8be5154d8303f504f113d836460235de96c446))
* add proper permission to release id-token ([e5e5749](https://github.com/kuzzleio/kuzzle/commit/e5e5749de32043652a69e9bb0d5164446c978507))
* build ([6d51c6d](https://github.com/kuzzleio/kuzzle/commit/6d51c6dc6bbb389faea981dc8322e4516086055a))
* modify github token to allow workflow to be triggered sequantialy ([3c4dce9](https://github.com/kuzzleio/kuzzle/commit/3c4dce919913bd18c2ab4f29ebd1f4da55e37e5f))
* package-lock.json update, along side kuzzle-sdk ([94dd59b](https://github.com/kuzzleio/kuzzle/commit/94dd59bf79728aaa2e487f03e5288be516c429ee))
* publish sbom after release to let semantic push ([34d6424](https://github.com/kuzzleio/kuzzle/commit/34d6424f20648edf103214b5ce3fc6728c7eacc9))
* remove the script in preinstall ([edce3d7](https://github.com/kuzzleio/kuzzle/commit/edce3d7293a4f2e7e8c6df037ee29b8536f4cd1b))
* remove version 18 from trixoe ([01f9d53](https://github.com/kuzzleio/kuzzle/commit/01f9d5343db4b095881e1bfcdcde437f2a58084d))
* removed the token used for npm, use trusted publisher system instead ([fcb0f06](https://github.com/kuzzleio/kuzzle/commit/fcb0f0640587db61d46065e716b347d0a089724e))
* runner ci ([538428c](https://github.com/kuzzleio/kuzzle/commit/538428c1f897c1b636ff3383e02bd0d155f0dd97))
* runner image, wasn't build for arm ([5f25b9d](https://github.com/kuzzleio/kuzzle/commit/5f25b9d530a4a31f9cb6d577095f77d9fb801939))
* sonarcloud update ([bc084f7](https://github.com/kuzzleio/kuzzle/commit/bc084f7047597ef4d4a46a2980e02b4e18ff3a0c))

## [2.50.0-beta.9](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.8...v2.50.0-beta.9) (2025-12-17)

### Bug Fixes

* sonarcloud update ([bc084f7](https://github.com/kuzzleio/kuzzle/commit/bc084f7047597ef4d4a46a2980e02b4e18ff3a0c))

## [2.50.0-beta.8](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.7...v2.50.0-beta.8) (2025-12-17)

### Bug Fixes

* publish sbom after release to let semantic push ([34d6424](https://github.com/kuzzleio/kuzzle/commit/34d6424f20648edf103214b5ce3fc6728c7eacc9))

## [2.50.0-beta.7](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.6...v2.50.0-beta.7) (2025-12-16)

### Bug Fixes

* build ([6d51c6d](https://github.com/kuzzleio/kuzzle/commit/6d51c6dc6bbb389faea981dc8322e4516086055a))
* package-lock.json update, along side kuzzle-sdk ([94dd59b](https://github.com/kuzzleio/kuzzle/commit/94dd59bf79728aaa2e487f03e5288be516c429ee))

## [2.50.0-beta.6](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.5...v2.50.0-beta.6) (2025-12-16)

### Bug Fixes

* modify github token to allow workflow to be triggered sequantialy ([3c4dce9](https://github.com/kuzzleio/kuzzle/commit/3c4dce919913bd18c2ab4f29ebd1f4da55e37e5f))

## [2.50.0-beta.5](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.4...v2.50.0-beta.5) (2025-12-16)

### Bug Fixes

* add main and types entries in packa ([4f8be51](https://github.com/kuzzleio/kuzzle/commit/4f8be5154d8303f504f113d836460235de96c446))

## [2.50.0-beta.4](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.3...v2.50.0-beta.4) (2025-12-16)

### Bug Fixes

* remove the script in preinstall ([edce3d7](https://github.com/kuzzleio/kuzzle/commit/edce3d7293a4f2e7e8c6df037ee29b8536f4cd1b))

## [2.50.0-beta.3](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.2...v2.50.0-beta.3) (2025-12-16)

### Bug Fixes

* add proper permission to release id-token ([e5e5749](https://github.com/kuzzleio/kuzzle/commit/e5e5749de32043652a69e9bb0d5164446c978507))
* removed the token used for npm, use trusted publisher system instead ([fcb0f06](https://github.com/kuzzleio/kuzzle/commit/fcb0f0640587db61d46065e716b347d0a089724e))

## [2.50.0-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.50.0-beta.1...v2.50.0-beta.2) (2025-12-16)

### Features

* bump deps ([b796f0b](https://github.com/kuzzleio/kuzzle/commit/b796f0bd214667b3e18cf4bbe36c0ce4e1f68b43))

## [2.50.0-beta.1](https://github.com/kuzzleio/kuzzle/compare/v2.49.1...v2.50.0-beta.1) (2025-12-16)


### Features

* nodejs 24 in actions ([723488c](https://github.com/kuzzleio/kuzzle/commit/723488c1c4f7647c46cbd26ba82a71952ccbba9e))
* nodejs 24 support ([f420b17](https://github.com/kuzzleio/kuzzle/commit/f420b171e8dab9afcbf57f2ca732d90ef4b1f99b))
* typescript updates ([a8256ca](https://github.com/kuzzleio/kuzzle/commit/a8256ca0b3e0790ae72ccbf4a2bc5cdd56d76b23))


### Bug Fixes

* _id sort on searchRoles not allowed with es8 ([f8d5c3e](https://github.com/kuzzleio/kuzzle/commit/f8d5c3e0a06870be3f65a083c077cb668c0e5da3))
* remove version 18 from trixoe ([01f9d53](https://github.com/kuzzleio/kuzzle/commit/01f9d5343db4b095881e1bfcdcde437f2a58084d))
* runner ci ([538428c](https://github.com/kuzzleio/kuzzle/commit/538428c1f897c1b636ff3383e02bd0d155f0dd97))
* runner image, wasn't build for arm ([5f25b9d](https://github.com/kuzzleio/kuzzle/commit/5f25b9d530a4a31f9cb6d577095f77d9fb801939))

## [2.49.1](https://github.com/kuzzleio/kuzzle/compare/v2.49.0...v2.49.1) (2025-11-18)


### Bug Fixes

* **accessLogger:** fix missing file transport acceslogger config scenario ([88a3459](https://github.com/kuzzleio/kuzzle/commit/88a3459fb7ae38c7b107cf79cd7e3468fd983286))

## [2.49.0](https://github.com/kuzzleio/kuzzle/compare/v2.48.0...v2.49.0) (2025-11-17)


### Features

* **accessLogger:** replace winston by pino ([#2630](https://github.com/kuzzleio/kuzzle/issues/2630)) ([9c06ce3](https://github.com/kuzzleio/kuzzle/commit/9c06ce3886593196970deed38e90a2575ff71b7e))


### Bug Fixes

* **mWrite test:** do not delete index on start ([58e58be](https://github.com/kuzzleio/kuzzle/commit/58e58be6cae5a4d577ff89fd7f9e9e034ea64fd3))
* **mWrite:** do not remove custom kuzzleInfo from mWrite ([40f0131](https://github.com/kuzzleio/kuzzle/commit/40f01311b30634c8d5e1a9398a00c74872685c64))
* **plugin:** use global.nodeId to fill the plugin context accessors.nodeId ([0bc3314](https://github.com/kuzzleio/kuzzle/commit/0bc3314b54065a793b27b215967fac3d284ed7e0))
* **updateByQuery:** kuzinfo updated after updateByQuery ([caacf9b](https://github.com/kuzzleio/kuzzle/commit/caacf9b0613a5d4b33ce1fcd99f04ea71e632502))
* **updateByQuery:** no need to add kuzzleinfo to changes, it is updated later ([969d160](https://github.com/kuzzleio/kuzzle/commit/969d160c8d6e96ff85e0755ba3c82453608c093a))

## [2.48.0](https://github.com/kuzzleio/kuzzle/compare/v2.47.0...v2.48.0) (2025-10-02)


### Features

* kuzzle is compatible with redis-8 7 6 and 5 ([87e283e](https://github.com/kuzzleio/kuzzle/commit/87e283e913e526c96998243fdd6d57ef4a4715ad))
* **logger:** create logger child instances for plugins  ([#2621](https://github.com/kuzzleio/kuzzle/issues/2621)) ([05a8e57](https://github.com/kuzzleio/kuzzle/commit/05a8e57b96c94e638820ea3654e5c668c6c7cd28))
* update secrets usage in ci ([b6c5fe7](https://github.com/kuzzleio/kuzzle/commit/b6c5fe72fa606a4eda1841515b16171a2c645120))


### Bug Fixes

* **elasticsearch:** do not allow user to provide _kuzzle_info for M operations ([#2607](https://github.com/kuzzleio/kuzzle/issues/2607)) ([b6adb34](https://github.com/kuzzleio/kuzzle/commit/b6adb3461a213afddcc6f7c2fc92252c5204fc12))
* revert uuid upgrade, because of ESM compat ([dbe582a](https://github.com/kuzzleio/kuzzle/commit/dbe582a241fe9d85b21c856a47a26f2d9dd6c498))
* **tokenManager:** change log level to trace ([#2625](https://github.com/kuzzleio/kuzzle/issues/2625)) ([a91eeb2](https://github.com/kuzzleio/kuzzle/commit/a91eeb2c2b9e4bf0b9dc8cb8d0ce7a5f8d841325))

## [2.48.0-beta.2](https://github.com/kuzzleio/kuzzle/compare/v2.48.0-beta.1...v2.48.0-beta.2) (2025-10-02)


### Bug Fixes

* **tokenManager:** change log level to trace ([#2625](https://github.com/kuzzleio/kuzzle/issues/2625)) ([a91eeb2](https://github.com/kuzzleio/kuzzle/commit/a91eeb2c2b9e4bf0b9dc8cb8d0ce7a5f8d841325))

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
