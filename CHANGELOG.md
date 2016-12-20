*__note:__ the # at the end of lines are the pull request numbers on GitHub*

# Current



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
