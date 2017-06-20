# [1.0.0](https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0) (2017-06-20)

### Compatibility

| Kuzzle | Proxy |
|--------|-------|
| 1.0.0 | 1.0.0 |

#### Breaking changes

- [ [#882](https://github.com/kuzzleio/kuzzle/pull/882) ] Modernize notifier core module   ([scottinet](https://github.com/scottinet))
- [ [#879](https://github.com/kuzzleio/kuzzle/pull/879) ] Remove obsolete "proxy:*" events   ([scottinet](https://github.com/scottinet))
- [ [#815](https://github.com/kuzzleio/kuzzle/pull/815) ] Prevent dynamic collection/index creation   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#859](https://github.com/kuzzleio/kuzzle/pull/859) ] Use native elasticsearch constructor options   ([benoitvidis](https://github.com/benoitvidis))
- [ [#845](https://github.com/kuzzleio/kuzzle/pull/845) ] Re-add HTTP GET route for user login   ([ballinette](https://github.com/ballinette))
- [ [#840](https://github.com/kuzzleio/kuzzle/pull/840) ] Login API reshape   ([xbill82](https://github.com/xbill82))
- [ [#804](https://github.com/kuzzleio/kuzzle/pull/804) ] Refactor authentication plugin structure   ([dbengsch](https://github.com/dbengsch))
- [ [#771](https://github.com/kuzzleio/kuzzle/pull/771) ] Rename _kuzzle_info and metadata   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#753](https://github.com/kuzzleio/kuzzle/pull/753) ] Fixes #745 DSL.not* should match when the field is missing   ([benoitvidis](https://github.com/benoitvidis))
- [ [#778](https://github.com/kuzzleio/kuzzle/pull/778) ] Remove the route security:createOrReplaceUser    ([dbengsch](https://github.com/dbengsch))
- [ [#764](https://github.com/kuzzleio/kuzzle/pull/764) ] Inject the request in authentication verify callbacks   ([scottinet](https://github.com/scottinet))
- [ [#723](https://github.com/kuzzleio/kuzzle/pull/723) ] Implement the PluginContext "storage" accessor   ([dbengsch](https://github.com/dbengsch))
- [ [#710](https://github.com/kuzzleio/kuzzle/pull/710) ] Remove ES 2.x support and enforce use of ES 5+   ([dbengsch](https://github.com/dbengsch))
- [ [#698](https://github.com/kuzzleio/kuzzle/pull/698) ] The security/searchProfiles has a misleading argument   ([dbengsch](https://github.com/dbengsch))
- [ [#680](https://github.com/kuzzleio/kuzzle/pull/680) ] Standardization of the memory storage API   ([scottinet](https://github.com/scottinet))

#### Bug fixes

- [ [#884](https://github.com/kuzzleio/kuzzle/pull/884) ] Force uri to not ends with a slash (registration & requests)   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#878](https://github.com/kuzzleio/kuzzle/pull/878) ] Embeds non-KuzzleError errors from pipe plugins in PluginImplementationError error   ([scottinet](https://github.com/scottinet))
- [ [#877](https://github.com/kuzzleio/kuzzle/pull/877) ] Fix Kuzzle returning an unknown request id to the proxy   ([scottinet](https://github.com/scottinet))
- [ [#867](https://github.com/kuzzleio/kuzzle/pull/867) ] Fix incoherent behaviors regarding user credentials management   ([scottinet](https://github.com/scottinet))
- [ [#842](https://github.com/kuzzleio/kuzzle/pull/842) ] Fix unhandled errors on client disconnect   ([benoitvidis](https://github.com/benoitvidis))
- [ [#847](https://github.com/kuzzleio/kuzzle/pull/847) ] Fix response headers after authentication step using HTTP   ([ballinette](https://github.com/ballinette))
- [ [#828](https://github.com/kuzzleio/kuzzle/pull/828) ] Fixes broker consistency    ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#823](https://github.com/kuzzleio/kuzzle/pull/823) ] Fix missing notifications   ([benoitvidis](https://github.com/benoitvidis))
- [ [#825](https://github.com/kuzzleio/kuzzle/pull/825) ] Fix unhandled exception on unsubscribing multiple range operators   ([benoitvidis](https://github.com/benoitvidis))
- [ [#827](https://github.com/kuzzleio/kuzzle/pull/827) ] Fix elasticsearch unhandled 404 error   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#820](https://github.com/kuzzleio/kuzzle/pull/820) ] Fix internal error on realtime:join   ([benoitvidis](https://github.com/benoitvidis))
- [ [#817](https://github.com/kuzzleio/kuzzle/pull/817) ] Kuzzle fails to install on older Linux kernels   ([scottinet](https://github.com/scottinet))
- [ [#810](https://github.com/kuzzleio/kuzzle/pull/810) ] Fix Kuzzle crash report on a beforeAction plugin error   ([scottinet](https://github.com/scottinet))
- [ [#792](https://github.com/kuzzleio/kuzzle/pull/792) ] Fix Multiple concurrent requests being executed multiple times   ([benoitvidis](https://github.com/benoitvidis))
- [ [#797](https://github.com/kuzzleio/kuzzle/pull/797) ] DSL - Allow simple form for "regexp" operator   ([benoitvidis](https://github.com/benoitvidis))
- [ [#798](https://github.com/kuzzleio/kuzzle/pull/798) ] Fix elasticsearch error parser which crash when error got no body   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#783](https://github.com/kuzzleio/kuzzle/pull/783) ] Fix dsl & canonization heap space exhaustion   ([benoitvidis](https://github.com/benoitvidis))
- [ [#788](https://github.com/kuzzleio/kuzzle/pull/788) ] Prevent crash reports on controller plugins bugs   ([scottinet](https://github.com/scottinet))
- [ [#753](https://github.com/kuzzleio/kuzzle/pull/753) ] Fixes #745 DSL.not* should match when the field is missing   ([benoitvidis](https://github.com/benoitvidis))
- [ [#784](https://github.com/kuzzleio/kuzzle/pull/784) ] Wrap authentication errors in PluginImplementationError object   ([scottinet](https://github.com/scottinet))
- [ [#752](https://github.com/kuzzleio/kuzzle/pull/752) ] Disable Redis cache in profile and role repositories   ([dbengsch](https://github.com/dbengsch))
- [ [#777](https://github.com/kuzzleio/kuzzle/pull/777) ] Revoke associated JWTs on user deletion   ([scottinet](https://github.com/scottinet))
- [ [#767](https://github.com/kuzzleio/kuzzle/pull/767) ] DSL "bool" & "not" factorization fix   ([benoitvidis](https://github.com/benoitvidis))
- [ [#751](https://github.com/kuzzleio/kuzzle/pull/751) ] TypeError exception when removing a subscription   ([benoitvidis](https://github.com/benoitvidis))
- [ [#727](https://github.com/kuzzleio/kuzzle/pull/727) ] Fix the way we default the profile if it is not set   ([dbengsch](https://github.com/dbengsch))
- [ [#738](https://github.com/kuzzleio/kuzzle/pull/738) ] [HOTFIX] Remove customer subscriptions on disconnection   ([benoitvidis](https://github.com/benoitvidis))
- [ [#725](https://github.com/kuzzleio/kuzzle/pull/725) ] Elasticsearch 5 expects index property in mapping to be a boolean   ([dbengsch](https://github.com/dbengsch))
- [ [#718](https://github.com/kuzzleio/kuzzle/pull/718) ] Allow to define 0 for thread in plugin config   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#715](https://github.com/kuzzleio/kuzzle/pull/715) ] Fix server:getConfig route   ([scottinet](https://github.com/scottinet))
- [ [#684](https://github.com/kuzzleio/kuzzle/pull/684) ] Fix security:searchRole API route   ([ballinette](https://github.com/ballinette))
- [ [#704](https://github.com/kuzzleio/kuzzle/pull/704) ] Missing PartialError serialization   ([scottinet](https://github.com/scottinet))
- [ [#701](https://github.com/kuzzleio/kuzzle/pull/701) ] Fix bug:websocketClient clear ping timer on close if socket is down   ([benoitvidis](https://github.com/benoitvidis))
- [ [#693](https://github.com/kuzzleio/kuzzle/pull/693) ] Use repositories.validateAndSave* method to reset profiles and roles at createFirstAdmin action   ([ballinette](https://github.com/ballinette))
- [ [#688](https://github.com/kuzzleio/kuzzle/pull/688) ] Fix mapping for profile:   ([ballinette](https://github.com/ballinette))
- [ [#683](https://github.com/kuzzleio/kuzzle/pull/683) ] Add new request events   ([scottinet](https://github.com/scottinet))
- [ [#671](https://github.com/kuzzleio/kuzzle/pull/671) ] Protect document creation to avoid collision with http routes   ([dbengsch](https://github.com/dbengsch))
- [ [#674](https://github.com/kuzzleio/kuzzle/pull/674) ] Prevent plugins infinite loop caused by triggered before/after events   ([scottinet](https://github.com/scottinet))

#### New features

- [ [#807](https://github.com/kuzzleio/kuzzle/pull/807) ] Adds a replaceUser route   ([samniisan](https://github.com/samniisan))
- [ [#821](https://github.com/kuzzleio/kuzzle/pull/821) ] Add Document:exists route   ([samniisan](https://github.com/samniisan))
- [ [#838](https://github.com/kuzzleio/kuzzle/pull/838) ] Add healthCheck action   ([ballinette](https://github.com/ballinette))
- [ [#833](https://github.com/kuzzleio/kuzzle/pull/833) ] Graceful shutdown implementation   ([scottinet](https://github.com/scottinet))
- [ [#780](https://github.com/kuzzleio/kuzzle/pull/780) ] Added a new route to list registrated plugin passport strategies   ([samniisan](https://github.com/samniisan))
- [ [#750](https://github.com/kuzzleio/kuzzle/pull/750) ] Add methods scrollUsers, scrollProfiles and scrollSpecifications   ([scottinet](https://github.com/scottinet))
- [ [#723](https://github.com/kuzzleio/kuzzle/pull/723) ] Implement the PluginContext "storage" accessor   ([dbengsch](https://github.com/dbengsch))

#### Enhancements

- [ [#869](https://github.com/kuzzleio/kuzzle/pull/869) ] Add new trigger on error   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#873](https://github.com/kuzzleio/kuzzle/pull/873) ] Add trigger pipe after authentication   ([ballinette](https://github.com/ballinette))
- [ [#859](https://github.com/kuzzleio/kuzzle/pull/859) ] Use native elasticsearch constructor options   ([benoitvidis](https://github.com/benoitvidis))
- [ [#844](https://github.com/kuzzleio/kuzzle/pull/844) ] Add HTTP request headers to request context   ([ballinette](https://github.com/ballinette))
- [ [#840](https://github.com/kuzzleio/kuzzle/pull/840) ] Login API reshape   ([xbill82](https://github.com/xbill82))
- [ [#806](https://github.com/kuzzleio/kuzzle/pull/806) ] Delete now deactivate a document and notify by filters   ([jenow](https://github.com/jenow))
- [ [#839](https://github.com/kuzzleio/kuzzle/pull/839) ] Improve healthCheck result message   ([ballinette](https://github.com/ballinette))
- [ [#809](https://github.com/kuzzleio/kuzzle/pull/809) ] Anonymous should always be able to log in   ([benoitvidis](https://github.com/benoitvidis))
- [ [#799](https://github.com/kuzzleio/kuzzle/pull/799) ] Autogenerate JWT salt   ([benoitvidis](https://github.com/benoitvidis))
- [ [#771](https://github.com/kuzzleio/kuzzle/pull/771) ] Rename _kuzzle_info and metadata   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#786](https://github.com/kuzzleio/kuzzle/pull/786) ] Add crash reports history limits   ([scottinet](https://github.com/scottinet))
- [ [#749](https://github.com/kuzzleio/kuzzle/pull/749) ] Wait plugin initialization with promises   ([dbengsch](https://github.com/dbengsch))
- [ [#748](https://github.com/kuzzleio/kuzzle/pull/748) ] Enable to setup kuzzle with a Elasticsearch cluster   ([ballinette](https://github.com/ballinette))
- [ [#741](https://github.com/kuzzleio/kuzzle/pull/741) ] Make ES actions responsible of retrieving their id and body attributes   ([scottinet](https://github.com/scottinet))
- [ [#739](https://github.com/kuzzleio/kuzzle/pull/739) ] Keep track of previously run requests   ([scottinet](https://github.com/scottinet))
- [ [#734](https://github.com/kuzzleio/kuzzle/pull/734) ] Improve Elasticsearch errors handling   ([scottinet](https://github.com/scottinet))
- [ [#736](https://github.com/kuzzleio/kuzzle/pull/736) ] Add a new request:onUnauthorized global event   ([scottinet](https://github.com/scottinet))
- [ [#706](https://github.com/kuzzleio/kuzzle/pull/706) ] Add support for HTTP HEAD requests   ([scottinet](https://github.com/scottinet))
- [ [#695](https://github.com/kuzzleio/kuzzle/pull/695) ] Add new role & profile core events   ([ballinette](https://github.com/ballinette))
- [ [#689](https://github.com/kuzzleio/kuzzle/pull/689) ] Remove usage of `allowInternalIndex` within policies   ([ballinette](https://github.com/ballinette))
- [ [#673](https://github.com/kuzzleio/kuzzle/pull/673) ] Add error stacktrace when a plugin fails to load   ([scottinet](https://github.com/scottinet))

#### Others

- [ [#826](https://github.com/kuzzleio/kuzzle/pull/826) ] Improve debug function to allow toggle one/multiple lines   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#732](https://github.com/kuzzleio/kuzzle/pull/732) ] Hotfix test that randomly break due to randomness introduced by highwayhash   ([dbengsch](https://github.com/dbengsch))
- [ [#717](https://github.com/kuzzleio/kuzzle/pull/717) ] Remove PluginImplementationError from the diagtools whitelist   ([scottinet](https://github.com/scottinet))
- [ [#658](https://github.com/kuzzleio/kuzzle/pull/658) ] Enable hot reload on plugins   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#647](https://github.com/kuzzleio/kuzzle/pull/647) ] Elasticsearch emits unnecessary log events   ([dbengsch](https://github.com/dbengsch))
- [ [#686](https://github.com/kuzzleio/kuzzle/pull/686) ] Add extraParams argument to getElasticsearchRequest   ([xbill82](https://github.com/xbill82))
- [ [#675](https://github.com/kuzzleio/kuzzle/pull/675) ] Update node prerequisite in package.json   ([scottinet](https://github.com/scottinet))
- [ [#661](https://github.com/kuzzleio/kuzzle/pull/661) ] Protect against multi-index and multi-collection search requests   ([dbengsch](https://github.com/dbengsch))
- [ [#654](https://github.com/kuzzleio/kuzzle/pull/654) ] Improve separation of concern on roleRepository::searchRole() method   ([ballinette](https://github.com/ballinette))

#### Securities

- [ [#799](https://github.com/kuzzleio/kuzzle/pull/799) ] Autogenerate JWT salt   ([benoitvidis](https://github.com/benoitvidis))
- [ [#721](https://github.com/kuzzleio/kuzzle/pull/721) ] Replace MD5 with HighwayHash   ([scottinet](https://github.com/scottinet))
- [ [#719](https://github.com/kuzzleio/kuzzle/pull/719) ] Do not export sensitive configuration on server:getConfig API route   ([scottinet](https://github.com/scottinet))
---

*__note:__ the # at the end of lines are the pull request numbers on GitHub*

# Current

# 1.0.0-RC9

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC9

### Breaking changes

* Plugin: full refactoring of the plugin management and installation: #609 #633
* HTTP: Some routes are redefined to comply more with method meanings: #603 #607 #616
* Controllers: `getUserMapping` and `setUserMapping` actions moved from `collection` to `security` controller #624
* Controllers: rename action `mGetProfiles` and `mGetRoles` to respectively `mGetProfile` and `mGetRole` #623


# 1.0.0-RC8

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC8

### Breaking changes

* Events: Normalize memoryStorage events to ms events #582
* Events, Controller and Actions: Controllers and actions refactor #569
* Events, Plugin, HTTP routes and internals: Harmonization of the Request and result handling #559
* Internal: Moved default docker-compose.yml file in [kuzzle-build](https://github.com/kuzzleio/kuzzle-build) #566
* Internal: New real-time engine #510
* Plugin: Controller plugins definition #563
* API: Protect internal index in elasticsearch service #538

# 1.0.0-RC7

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC7

### Breaking changes

* CLI: `service` commands removed #405
* Kuzzle `bulk`.`import` action now expects a `body.bulkData` property that contains an array #387
* DSL: `term` and `terms` operators are repectively replaced by `equals`and `in` #392
* DSL: filters ids cannot be set manually anymore #401

# 1.0.0-RC6.2

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC6.2

# 1.0.0-RC6.1

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC6.1

# 1.0.0-RC6

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC6

### Breaking changes

* Rename a couple of DSL keywords to avoid confusion with Elasticsearch's DSL #392
* Remove `createFilterId` from the real-time engine exposed methods. The filter's unique ID is now returned by the `register` method #401


# 1.0.0-RC5

* https://github.com/kuzzleio/kuzzle/releases/tag/1.0.0-RC5

# 1.0.0-RC4

* Add new hooks allowing to manage Kuzzle internal states #329
* Add a `--noColors` option to the command-line interface #330
* Remove `remoteActions` core component from the plugin context #331
* Overhaul of the plugin context to make it simpler and more consistent #316, #323, #333
* Add a ``--importConfig`` flag to the plugin management part of the CLI #315
* Improve code documentation, IDE integration and lint checks #317
* Add regular expression support to the real-time DSL #321
* Fix #339: unsubscribing from a subfilter cleans all related global filters #340
* Fix #335: startup sequence fails if the index cache initialization takes too long #336
* Fix #337: cannot install npm-based plugins after installing a plugin from a directory path #338
* Fix #322: broker client does not initialize if an error occurs on its first try #324
* Fix #302: unable to unsubscribe filters containing nested attributes #304
* Fix: plugin installation from a git repository doesn't work #325


# 1.0.0-RC3

* Temporary fix repositories #312
* Add Errors objects into PluginContext #310
* Fix issue #295 : Kuzzle Worker doesn't start correctly
* Add swagger support #281 #307
* Fix filtering issues: #302, #263
* Fix docker-compose images #261 #278 #300
* Share DSL to plugins #291
* Roles refactoring #232 #286
* Fixed status code 0 on default HTTP route #297
* Update plugins dependencies #293
* Add communication with Kuzzle proxy #284
* Fix plugins installation implementation #290
* Replace eval with arguments storage #289
* Split internal broker into client and server #285
* Add cli plugins --list option #288
* Implements kuzzle-common-objects #283
* Little fix on closure args definition #279
* Expose httpPort config in context #280
* Fix user profile update #275
* Allow plugins to register an event on multiple functions #274
* Fix realtime collections listing #267
* Make roles impossible to remove if profiles still use them #259
* Fix issue #264 : ./bin/kuzzle install fails
* ElasticSearch autorefresh workaround #257
* Path plugins configuration now taken from plugins dir #260
* Remove unnecessary passport local plugin default config #258
* Redis Cluster + Worker & Services catch error #254

# 1.0.0-RC2.1

* Solves issue #264

# 1.0.0-RC2

* Refactored CLI and Remote actions #208
* Fixed index and filter removal path #236
* Refactored ResponseObject #238
* Added plugin worker and events documentation #237
* Added the list of available API routes to root url #243
* Added unit test stubs #240
* Moved the embedded documentation to external "kuzzle-guide" repository #249
* Removed obsolete internal broker queue #251
* Added updateSelf action in auth controller #248
* Fixed the plugin controller #256
* Moved the plugin configurations in database #253
* Refactored Error Response #255

# 1.0.0-RC1

* Fix getServerInfo route #231
* Documentation about path in plugin configuration #228
* New memoryStorage controller, aliased to ms #224
* All redis commands are exposed, excepted: #224
  * script related commands
  * cluster related commands
  * pubsub commands
  * cursor commands
* ResponseObject now accepts a result that can be resolved to false #224
* Security routes fixes #225 :
   Fixes issue #215 and more: several security weren't returning any useful data in the response, namely updateRole, updateProfile, updateUser, and deleteUser
* Started to update repositories to make them return raw objects instead of ResponseObject. #225
* Removed useless MQ functional tests #223
* Prevent event loop saturation (see #217 for details)
* Fix problem with multi scope on same app #220
* Fixed performance issue + updated dependencies #216
  - Hydrated roles weren't stored in the profile cache, forcing a call to Elasticsearch on each request
  - Updated dependencies
  - Fixed breaking changes between lodash 3.10 and 4.6
  - Fixed new errors fired by ESLint 2
  - Deactivated ESLint `consistent-return` rule, as it appears to be bugged for the moment
  - Removed `async` use from `Request.checkInformation`, as it was overkill
* Feature/docker switch to alpine #207
* small doc refactor #213
* Fix from/to dsl operators #211
* Beta fix admin user token #210
* Removed hardcoded loading of user admin in token repository #209
* Removed hardcoded loading of user admin #205
* fixes issue #199 #202
* Add enabled false on indexes in roles mapping #196
* Feature user rights documentation #195
* Reapply " Migration to ES 2.2" #201
* Enhance closures with fetch in users roles #183

# 1.0.0-beta.4

* updated dependency version for kuzzle-plugin-auth-passport-local #181
* refactor cli / first Admin creation process (add option to not reset roles/profiles) #182

# 1.0.0-beta.3

* Add auth:checkToken into the anonymous & default role

# 1.0.0-beta.1

* Fix bug on update role & profile #176

# 1.0.0-beta.0

* Kuzzle is now entering in beta! Feel free to contribute.

# 0.18.2

* Role serialization now allows indexing custom properties
* Fixed updateRole REST API route

# 0.18.1

* uniform response from createOrReplaceRole / createOrReplaceProfile

# 0.18.0

* Adds the first admin creation process to the CLI

# 0.17.5

* format user for serialization hydrate #170

# 0.17.4

* Bugfix: the token manager didn't check the availability of the connection part of a connection context before adding the token to the cache.

# 0.17.3

* Bugfix:remove bad return responseobject in createOrReplaceUser

# 0.17.2

* Bugfix on index creation rights

# 0.17.1

* Bugfix: Profile creation was not stopped when attempting to link to a non-existing role

# 0.17.0

* createRole & createProfile routes #160
