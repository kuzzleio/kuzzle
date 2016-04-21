# Table of Contents

* [Table of Contents](#table-of-contents)
* [About](#about)
* [Plugins Configuration](#plugins-configuration)
* [Default plugins](#default-plugins)
  * [Logger](#logger)
  * ["Passport Local" Authentication](#passport-local-authentication" aria-hidden="true"><span class="octicon octicon-link"></span></a>"Passport Local)
  * [Socket.io communication support](#socketio-communication-support)
* [How to create a plugin](#how-to-create-a-plugin)
  * [Configuration](#configuration)
  * [Events triggered](#events-triggered)
  * [The plugin context](#the-plugin-context)
  * [Architecture](#architecture)
  * [The plugin init function](#the-plugin-init-function)
    * [Listener plugins](#listener-plugins)
    * [Worker plugins](#worker-plugins)
    * [Pipe plugins](#pipe-plugins)
    * [Controllers](#controllers)
      * [How it works](#how-it-works)
    * [Protocol plugins](#protocol-plugins)
      * [How it works](#how-it-works-1)
      * [Example](#example)
  * [Examples](#examples)
* [Troubleshooting](#troubleshooting)
  * [Proxy](#proxy)



# About

Plugins are external components allowing to execute functions on specific event triggering.  
There are several types of plugins:

* Hook events: just listen to events and perform other actions (ie: a log plugin). They do not respond to anything directly, they just listen.
* Workers: just like Hook plugins, they only listen without responding but Workers are running on another process. Useful when a plugin has many complex computation to perform.
* Pipe events: perform an action and return something. Kuzzle is waiting that all pipe events are performed before continuing.
* Controllers: add a specific controller to Kuzzle.

# Plugins Configuration

Some plugins can be configured. To customize these plugins, all you have to do is to create a file `config/customPlugins.json`, and to put it in the `config/` Kuzzle directory.  

If your Kuzzle is running inside a docker image, you'll have to inject this file in the image.  
In `docker-compose.yml` file, you can have something like:

```yaml
kuzzle:
  image: kuzzleio/kuzzle
  volumes:
    - "host/path/to/customPlugins.json:/var/app/config/customPlugins.json"
  ports:
    - "7511:7511"
    - "7512:7512"
  links:
    - elasticsearch
    - redis
```

Plugins configuration have the following default attributes:

* `path`: The local path where the plugin is hosted on the server.
* `url`: a git URL where the plugin can be found and cloned.
* `version`: the NPM package version to download
* `customConfig`: config for the plugin. Each plugin has a different configuration (required or optional), check the corresponding plugin documentation for more information.
* `defaultConfig`: Don't edit this attribute. The defaultConfig is provided by the plugin itself. If you need to change the configuration, edit the `customConfig` attribute

**Note:**
* A `path`, a `url`, or a `version` parameter is required. Priority is `path`, `url`, `version`; if more than one paramater is set, highest priority parameter is used and others will be ignored.

# Default plugins

## Logger

By default, the logger plugin is enabled and configured to use the service `winston` (refer to [kuzzle-plugin-logger documentation](https://github.com/kuzzleio/kuzzle-plugin-logger) for more information).  

## "Passport Local" Authentication

By default, the a standard "passport-local" plugin is enabled to authenticate users with their username/password (refer to [kuzzle-plugin-auth-passport-local documentation](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local) for more information).

See also the [global authentication mechanism documentation](security/authentication.md).

## Socket.io communication support

By default, the protocol plugin [socket.io](https://github.com/kuzzleio/kuzzle-plugin-socketio) is installed, allowing to access Kuzzle using Socket.io clients.

The default plugin configuration opens the port `7512`. This can be changed by injecting a custom plugin configuration file.

# How to create a plugin

A plugin is a Javascript module that can be installed with NPM or via a public GIT repository.

## Configuration

The module must have a `package.json` file with a `pluginInfo` entry. The optional `defaultConfig` will be copied in files `config/defaultPlugins.json` and `config/customPlugins.json` in Kuzzle.

```json
"pluginInfo": {
    "loadedBy": "server",
    "defaultConfig": {
      "service": "winston",
      "level": "info",
      "addDate": true
    },
    "threads": 2
  }
```

* The `loadedBy` option tells Kuzzle to install and load the plugin only by corresponding instance types. The accepted values are: `all`, `server` and `worker`. Default value: `all`.
* The `threads` option tells Kuzzle to load the plugin into different process and scale up to two process. Check [Worker communication](#worker-plugins) for more information.

##  Events triggered

On each of following events, you can attach a function to execute in your plugin. In this function you **HAVE** to return an object similar to the input, because Kuzzle need it for internal purpose.

| Event | Controller| Action | Description | Input |
|-------|-----------|--------|-------------|-------|
|**data**|||
|`data:beforeUpdateMapping`     | `admin` | `updateMapping` |Triggered before controller `admin` and action `updateMapping`|Type: Request object|
|`data:afterUpdateMapping`      | `admin` | `updateMapping` |Triggered after controller `admin` and action `updateMapping`|Type: Response object|
|`data:beforeGetMapping`        | `admin` | `getMapping` |Triggered before controller `admin` and action `getMapping`|Type: Request object|
|`data:afterGetMapping`         | `admin` | `getMapping` |Triggered after controller `admin` and action `getMapping`|Type: Response object|
|`data:beforeGetStats`          | `admin` | `getStats` |Triggered before controller `admin` and action `getStats`|Type: Request object|
|`data:afterGetStats`           | `admin` | `getStats` |Triggered after controller `admin` and action `getStats`|Type: Response object|
|`data:beforeGetLastStats`      | `admin` | `getLastStats` |Triggered before controller `admin` and action `getLastStats`|Type: Request object|
|`data:afterGetLastStats`       | `admin` | `getLastStats` |Triggered after controller `admin` and action `getLastStats`|Type: Response object|
|`data:beforeGetAllStats`       | `admin` | `getAllStats` |Triggered before controller `admin` and action `getAllStats`|Type: Request object|
|`data:afterGetAllStats`        | `admin` | `getAllStats` |Triggered after controller `admin` and action `getAllStats`|Type: Response object|
|`data:beforeTruncateCollection`| `admin` | `truncateCollection` |Triggered before controller `admin` and action `truncateCollection`|Type: Request object|
|`data:afterTruncateCollection` | `admin` | `truncateCollection` |Triggered after controller `admin` and action `truncateCollection`|Type: Response object|
|`data:beforeDeleteIndexes`     | `admin` | `deleteIndexes` |Triggered before controller `admin` and action `deleteIndexes`|Type: Request object|
|`data:afterDeleteIndexes`      | `admin` | `deleteIndexes` |Triggered after controller `admin` and action `deleteIndexes`|Type: Response object|
|`data:beforeCreateIndex`       | `admin` | `createIndex` |Triggered before controller `admin` and action `createIndex`|Type: Request object|
|`data:afterCreateIndex`        | `admin` | `createIndex` |Triggered after controller `admin` and action `createIndex`|Type: Response object|
|`data:beforeDeleteIndex`       | `admin` | `deleteIndex` |Triggered before controller `admin` and action `deleteIndex`|Type: Request object|
|`data:afterDeleteIndex`        | `admin` | `deleteIndex` |Triggered after controller `admin` and action `deleteIndex`|Type: Response object|
|`data:beforeRefreshIndex`      | `admin` | `refreshIndex` |Triggered before controller `admin` and action `refreshIndex`.|Type: Request object|
|`data:afterRefreshIndex`       | `admin` | `refreshIndex` |Triggered after controller `admin` and action `refreshIndex`.|Type: Response object|
|`data:beforeBulkImport`        | `bulk` | `import` |Triggered before controller `bulk` and action `import`.|Type: Response object|
|`data:afterBulkImport`         | `bulk` | `import` |Triggered after controller `bulk` and action `import`.|Type: Response object|
|`data:beforeSearch`            | `read` | `search` |Triggered before controller `read` and action `search`.|Type: Request object|
|`data:afterSearch`             | `read` | `search` |Triggered after controller `read` and action `search`.|Type: Response object|
|`data:beforeGet`               | `read` | `get` |Triggered before controller `read` and action `get`.|Type: Request object|
|`data:afterGet`                | `read` | `get` |Triggered after controller `read` and action `get`.|Type: Response object|
|`data:beforeCount`             | `read` | `count` |Triggered before controller `read` and action `count`.|Type: Request object|
|`data:afterCount`              | `read` | `count` |Triggered after controller `read` and action `count`.|Type: Response object|
|`data:beforeListCollections`   | `read` | `listCollections` |Triggered before controller `read` and action `listCollections`.|Type: Request object|
|`data:afterListCollections`    | `read` | `listCollections` |Triggered after controller `read` and action `listCollections`.|Type: Response object|
|`data:beforeNow`               | `read` | `now` |Triggered before controller `read` and action `now`.|Type: Request object|
|`data:afterNow`                | `read` | `now` |Triggered after controller `read` and action `now`.|Type: Response object|
|`data:beforeListIndexes`       | `read` | `listIndexes` |Triggered before controller `read` and action `listIndexes`.|Type: Request object|
|`data:afterListIndexes`        | `read` | `listIndexes` |Triggered after controller `read` and action `listIndexes`.|Type: Response object|
|`data:afterServerInfo`         | `read` | `serverInfo` |Triggered after controller `read` and action `serverInfo`.|Type: Response object|
|`data:beforeCreate`        	| `write` | `create` |Triggered before controller `write` and action `create`.|Type: Request object|
|`data:beforeCreate`        	| `write` | `create` |Triggered before controller `write` and action `create`.|Type: Request object|
|`data:afterCreate`         	| `write` | `create` |Triggered after controller `write` and action `create`.|Type: Response object|
|`data:beforePublish`        	| `write` | `publish` |Triggered before controller `write` and action `publish`.|Type: Request object|
|`data:afterPublish`         	| `write` | `publish` |Triggered after controller `write` and action `publish`.|Type: Response object|
|`data:beforeCreateOrReplace`   | `write` | `createOrReplace` |Triggered before controller `write` and action `createOrReplace`.|Type: Request object|
|`data:afterPublish`         	| `write` | `createOrReplace` |Triggered after controller `write` and action `createOrReplace`.|Type: Response object|
|`data:beforeCreateOrReplace`   | `write` | `createOrReplace` |Triggered before controller `write` and action `createOrReplace`.|Type: Request object|
|`data:afterPublish`         	| `write` | `createOrReplace` |Triggered after controller `write` and action `createOrReplace`.|Type: Response object|
|`data:beforeUpdate`   			| `write` | `update` |Triggered before controller `write` and action `update`.|Type: Request object|
|`data:afterUpdate`         	| `write` | `update` |Triggered after controller `write` and action `update`.|Type: Response object|
|`data:beforeReplace`   		| `write` | `replace` |Triggered before controller `write` and action `replace`.|Type: Request object|
|`data:afterReplace`         	| `write` | `replace` |Triggered after controller `write` and action `replace`.|Type: Response object|
|`data:beforeDelete`   			| `write` | `delete` |Triggered before controller `write` and action `delete`.|Type: Request object|
|`data:afterDelete`         	| `write` | `delete` |Triggered after controller `write` and action `delete`.|Type: Response object|
|`data:beforeDeleteByQuery`   	| `write` | `deleteByQuery` |Triggered before controller `write` and action `deleteByQuery`.|Type: Request object|
|`data:afterDeleteByQuery`      | `write` | `deleteByQuery` |Triggered after controller `write` and action `deleteByQuery`.|Type: Response object|
|`data:beforeCreateCollection`  | `write` | `createCollection` |Triggered before controller `write` and action `createCollection`.|Type: Request object|
|`data:afterCreateCollection`   | `write` | `createCollection` |Triggered after controller `write` and action `createCollection`.|Type: Response object|
|**memoryStorage**|||
|`memoryStorage:before<Action>`	| `memoryStorage` | / |All actions in `memoryStorage` controller have a trigger before |Type: Request object|
|`memoryStorage:after<Action>`	| `memoryStorage` | / |All actions in `memoryStorage` controller have a trigger after |Type: Response object|
|**subscription**|||
|`subscription:beforeRemoveRooms`	| `admin` | `removeRooms` |Triggered before controller `admin` and action `removeRooms`. This action remove all rooms for a given collection|Type: Request object|
|`subscription:afterRemoveRooms`	| `admin` | `removeRooms` |Triggered after controller `admin` and action `removeRooms`. When the remove is done|Type: Response object|
|**security**|||
|`security:formatUserForSerialization`	| / | / |Triggered before serialize a user. Useful to clean a user like attribute `password`|Type: User|
|`security:beforeGetRole`				| `security` | `getRole` |Triggered before controller `security` and action `getRole`.|Type: Request object|
|`security:afterGetRole`				| `security` | `getRole` |Triggered after controller `security` and action `getRole`.|Type: Response object|
|`security:beforeMGetRoles`				| `security` | `mGetRoles` |Triggered before controller `security` and action `mGetRoles`.|Type: Request object|
|`security:afterMGetRoles`				| `security` | `mGetRoles` |Triggered after controller `security` and action `mGetRoles`.|Type: Response object|
|`security:beforeSearchRole`			| `security` | `searchRoles` |Triggered before controller `security` and action `searchRoles`.|Type: Request object|
|`security:afterSearchRole`				| `security` | `searchRoles` |Triggered after controller `security` and action `searchRoles`.|Type: Response object|
|`security:beforeCreateOrReplaceRole`	| `security` | `createOrReplaceRole` |Triggered before controller `security` and action `createOrReplaceRole`.|Type: Object.<br> `{context, requestObject}`|
|`security:afterCreateOrReplaceRole`	| `security` | `createOrReplaceRole` |Triggered after controller `security` and action `createOrReplaceRole`.|Type: Response object|
|`security:beforeCreateRole`			| `security` | `createRole` |Triggered before controller `security` and action `createRole`.|Type: Object.<br> `{context, requestObject}`|
|`security:afterCreateRole`				| `security` | `createRole` |Triggered after controller `security` and action `createRole`.|Type: Response object|
|`security:beforeDeleteRole`			| `security` | `deleteRole` |Triggered before controller `security` and action `deleteRole`.|Type: Request object|
|`security:afterDeleteRole`				| `security` | `deleteRole` |Triggered after controller `security` and action `deleteRole`.|Type: Response object|
|`security:beforeGetProfile`			| `security` | `getProfile` |Triggered before controller `security` and action `getProfile`.|Type: Request object|
|`security:afterGetProfile`				| `security` | `getProfile` |Triggered after controller `security` and action `getProfile`.|Type: Response object|
|`security:beforeMGetProfiles`			| `security` | `mGetProfiles` |Triggered before controller `security` and action `mGetProfiles`.|Type: Request object|
|`security:afterMGetProfiles`			| `security` | `mGetProfiles` |Triggered after controller `security` and action `mGetProfiles`.|Type: Response object|
|`security:beforeCreateOrReplaceProfile`| `security` | `createOrReplaceProfile` |Triggered before controller `security` and action `createOrReplaceProfile`.|Type: Object.<br> `{context, requestObject}`|
|`security:afterCreateOrReplaceProfile`	| `security` | `createOrReplaceProfile` |Triggered after controller `security` and action `createOrReplaceProfile`.|Type: Response object|
|`security:beforeCreateProfile`			| `security` | `createProfile` |Triggered before controller `security` and action `createProfile`.|Type: Object.<br> `{context, requestObject}`|
|`security:afterCreateProfile`			| `security` | `createProfile` |Triggered after controller `security` and action `createProfile`.|Type: Response object|
|`security:beforeDeleteProfile`			| `security` | `deleteProfile` |Triggered before controller `security` and action `deleteProfile`.|Type: Request object|
|`security:afterDeleteProfile`			| `security` | `deleteProfile` |Triggered after controller `security` and action `deleteProfile`.|Type: Response object|
|`security:beforeSearchProfiles`		| `security` | `searchProfiles` |Triggered before controller `security` and action `searchProfiles`.|Type: Request object|
|`security:afterSearchProfiles`			| `security` | `searchProfiles` |Triggered after controller `security` and action `searchProfiles`.|Type: Response object|
|`security:beforeGetUser`				| `security` | `getUser` |Triggered before controller `security` and action `getUser`.|Type: Request object|
|`security:afterGetUser`				| `security` | `getUser` |Triggered after controller `security` and action `getUser`.|Type: Response object|
|`security:beforeSearchUsers`			| `security` | `searchUsers` |Triggered before controller `security` and action `searchUsers`.|Type: Request object|
|`security:afterSearchUsers`			| `security` | `searchUsers` |Triggered after controller `security` and action `searchUsers`.|Type: Response object|
|`security:beforeDeleteUser`			| `security` | `deleteUser` |Triggered before controller `security` and action `deleteUser`.|Type: Request object|
|`security:afterDeleteUser`				| `security` | `deleteUser` |Triggered after controller `security` and action `deleteUser`.|Type: Response object|
|`security:beforeCreateUser`			| `security` | `createUser` |Triggered before controller `security` and action `createUser`.|Type: Request object|
|`security:afterCreateUser`				| `security` | `createUser` |Triggered after controller `security` and action `createUser`.|Type: Response object|
|`security:beforeUpdateUser`			| `security` | `updateUser` |Triggered before controller `security` and action `updateUser`.|Type: Request object|
|`security:afterUpdateUser`				| `security` | `updateUser` |Triggered after controller `security` and action `updateUser`.|Type: Response object|
|`security:beforeUpdateProfile`			| `security` | `updateProfile` |Triggered before controller `security` and action `updateProfile`.|Type: Object.<br> `{context, requestObject}`|
|`security:afterUpdateProfile`			| `security` | `updateProfile` |Triggered after controller `security` and action `updateProfile`.|Type: Response object|
|`security:beforeUpdateRole`			| `security` | `updateRole` |Triggered before controller `security` and action `updateRole`.|Type: Object.<br> `{context, requestObject}`|
|`security:afterUpdateRole`				| `security` | `updateRole` |Triggered after controller `security` and action `updateRole`.|Type: Response object|
|`security:beforeCreateOrReplaceUser`	| `security` | `createOrReplaceUser` |Triggered before controller `security` and action `createOrReplaceUser`.|Type: Request object|
|`security:afterCreateOrReplaceUser`	| `security` | `createOrReplaceUser` |Triggered after controller `security` and action `createOrReplaceUser`.|Type: Response object|
|**subscription**|||
|`subscription:beforeOn`	| `subscribe` | `on` |Triggered before controller `subscribe` and action `on`.|Type: Request object|
|`subscription:afterOn`		| `subscribe` | `on` |Triggered after controller `subscribe` and action `on`.|Type: Response object|
|`subscription:beforeJoin`	| `subscribe` | `join` |Triggered before controller `subscribe` and action `join`.|Type: Request object|
|`subscription:afterJoin`	| `subscribe` | `join` |Triggered after controller `subscribe` and action `join`.|Type: Response object|
|`subscription:beforeOff`	| `subscribe` | `off` |Triggered before controller `subscribe` and action `off`.|Type: Request object|
|`subscription:afterOff`	| `subscribe` | `off` |Triggered after controller `subscribe` and action `off`.|Type: Response object|
|`subscription:beforeCount`	| `subscribe` | `count` |Triggered before controller `subscribe` and action `count`.|Type: Request object|
|`subscription:afterCount`	| `subscribe` | `count` |Triggered after controller `subscribe` and action `count`.|Type: Response object|
|`subscription:beforeList`	| `subscribe` | `list` |Triggered before controller `subscribe` and action `list`.|Type: Request object|
|`subscription:afterList`	| `subscribe` | `list` |Triggered after controller `subscribe` and action `list`.|Type: Response object|
|**auth**|||
|`auth:beforeLogout`	| `auth` | `logout` |Triggered before controller `auth` and action `logout`.|Type: Context user.<br> `{profile, role, user, token}`|
|`auth:afterLogout`		| `auth` | `logout` |Triggered after controller `auth` and action `logout`.|Type: Response object|
|`auth:beforeLogin`		| `auth` | `login` |Triggered before controller `auth` and action `login`.|Type: Object.<br> `{context, requestObject}`|
|`auth:afterLogin`		| `auth` | `login` |Triggered after controller `auth` and action `login`.|Type: Response object|
|`auth:getCurrentUser`	| `auth` | `getCurrentUser` |Triggered before controller `auth` and action `getCurrentUser`.|Type: Request object|
|`auth:beforeCheckToken`| `auth` | `checkToken` |Triggered before controller `auth` and action `checkToken`.|Type: Request object|
|`auth:afterCheckToken`	| `auth` | `checkToken` |Triggered after controller `auth` and action `checkToken`.|Type: Response object|
|`auth:loadStrategies`	| /      |    /         |Triggered during authentication. This event allows to load the corresponding strategy. Take a look at the [Github Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-github) |Type: Passport|
|**passport**|||
|`passport:loadScope`		| / | / |Triggered during authentication. This event allow plugins to modify the scope with rights. Take a look at the [Github Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-github#configuration) |Type: Object.<br> `{scope}`|
|**room**|||
|`room:new`					| / | / |Triggered when a new room is added in the rooms list. You can't modify the input on this event.|Type: Object. <br> `{roomId, index, collection, formattedFilters}`|
|`room:remove`				| / | / |Triggered after a room is removed from the list. You can't modify the input on this event.|Type: String.<br> The room id|
|**protocol**|||
|`protocol:leaveChannel`	| / | / |Triggered before a room is removed for the user. You can't modify the input on this event.|Type: Object.<br>  `{channel, id}` <br>`channel` is the channel name.<br> `id` is the connection id|
|`protocol:joinChannel`		| / | / |Triggered after attach a user to a room. You can't modify the input on this event.|Type: Object.<br>  `{channel, id}` <br>`channel` is the channel name.<br> `id` is the connection id|
|`protocol:notify`			| / | / |Triggered before notify a connection id.|Type: Object.<br>  `{payload, channel, id}` <br>`payload` is the notification content. <br>`channel` is the channel name.<br> `id` is the connection id|
|`protocol:broadcast`		| / | / |Triggered before broadcast. You can't modify the input on this event.|Type: Object.<br>  `{payload, channel}` <br>`payload` is the notification content. <br>`channel` is the channel name.|
|**cleanDb**|||
|`cleanDb:deleteIndexes`| / | / |Triggered during `cleanDb` process just before indexes deletion. |Type: Request object.<br> Contains all indexes to delete in `requestObject.data.body.indexes`|
|`cleanDb:done`			| / | / |Triggered after indexes deletion.| / |
|`cleanDb:error`		| / | / |Triggered when an error occurred on clean db|Type: Error|
|**prepareDb**|||
|`prepareDb:createInternalIndex`	| / | / |Triggered on Kuzzle start for creating the internal index `%kuzzle`|Type: Request object.<br> Contains the internal index in `requestObject.index`|
|`prepareDb:updateMappingRoles`		| / | / |Triggered on Kuzzle start for creating the internal mapping for Roles collection|Type: Request object.<br> Contains the default mapping in `requestObject.data.body`|
|`prepareDb:updateMappingProfiles`	| / | / |Triggered on Kuzzle start for creating the internal mapping for Profiles collection|Type: Request object.<br> Contains the default mapping in `requestObject.data.body`|
|`prepareDb:updateMappingUsers`		| / | / |Triggered on Kuzzle start for creating the internal mapping for Users collection|Type: Request object.<br> Contains the default mapping in `requestObject.data.body`|
|`prepareDb:createFixturesIndex`	| / | / |Triggered during database preparation. Called for each index in fixtures|Type: Request object.<br> Contains the index to create in `requestObject.index`|
|`prepareDb:importMapping`			| / | / |Triggered during database preparation. Called for each mapping to import|Type: Request object.<br> Contains the index in `requestObject.index` and mapping in `requestObject.data.body`|
|`prepareDb:importFixtures`			| / | / |Triggered during database preparation. Called for each fixtures to import|Type: Request object.<br> Contains the index in `requestObject.index` and bulk in `requestObject.data.body`|
|`prepareDb:error`					| / | / |Triggered when an error occurred during database preparation|Type: Error|
|**server**|||
|`server:httpStarted`		| / | / |Triggered when the http server is started.|Type: String|
|`server:mqStarted`			| / | / |Triggered when the MQ server is started.|Type: String|
|`server:overload`			| / | / |Triggered when the server overload|Type: String.<br> Contains the overload percentage with '%' character|
|**internalBroker**|||
|`internalBroker:started`		| / | / |Triggered when the internal broker is started|Type: String.<br> `'Internal broker server started'`|
|`internalBroker:connected`		| / | / |Triggered when the internal broker is connected|Type: String.<br> `'Connected to Kuzzle server'`|
|`internalBroker:reregistering`	| / | / |Triggered when the internal broker is reregistered|Type: String.<br> `'Re-registering room: ' + room`|
|`internalBroker:error`			| / | / |Triggered when an error occured in internal broker|Type: Object.<br> {host, port, message, retry}|
|`internalBroker:socketClosed`	| / | / |Triggered when the socket is closed|Type: String|
|**workerGroup**|||
|`workerGroup:loaded`	| / | / |Triggered when workers are loaded|Type: String.<br> Worker group name|
|**rabbit**|||
|`rabbit:started`		| / | / |Triggered when rabbit MQ service is started|Type: String.<br> `'RabbitMQ Service started'`|
|`rabbit:error`			| / | / |Triggered when an error occured on rabbit connection|Type: Error|
|`rabbit:stopped`		| / | / |Triggered when the rabbit MQ service is stopped|Type: String.<br> `'RabbitMQ Service stopped'`|


## The plugin context

Plugins don't have access to the Kuzzle instance. Instead, Kuzzle provides a plugin ``context`` to the ``plugin.init()`` function.

Here is the list of shared objects contained in the provided ``context``:

| Object | Purpose                      |
|--------|------------------------------|
| ``RequestObject`` | Constructor for standardized requests sent to Kuzzle |
| ``ResponseObject`` | Constructor for the standardized Kuzzle non-realtime response objects |
| ``RealTimeResponseObject`` | Constructor for the standardized Kuzzle realtime response objects |
| Errors... | Kuzzle error constructors. The complete list can be found in the ``lib/api/core/errors`` directory |
| ``repositories()`` | Getter function to the security roles, profiles and users repositories |
| ``getRouter()`` | Getter function to the Kuzzle protocol communication system |

## Architecture

Your main javascript file in your plugin must have a function `init` and expose a `hooks` and/or a `pipes` and/or a `controllers` object. All functions defined in these files must be exposed as main object.


## The plugin init function

All plugins must expose a ``init`` function. Its purpose is to initialize the plugins according to its configuration.

Kuzzle calls these ``init`` function at startup, during initialization.

Expected arguments:
``function (config, context, isDummy)``

Where:
* ``config``: JSON object containing the plugin configuration (the content of the ``defaultConfig`` or the ``customConfig`` configuration)
* ``context``: the plugin context (see above)
* ``isDummy``: boolean. True: asks the plugin to not really start itself, but instead mock its functionalities (useful when testing plugins, kuzzle, or both)

### Listener plugins

Hook events are triggered and are non-blocking functions. Listener plugins are configured to be called on these hooks.

```js
// Somewhere in Kuzzle
kuzzle.pluginsManager.trigger('event:hookEvent', message);
```

```js
/*
  Plugin hooks configuration.
  Let's assume that we store this configuration in a "hooks.js" file
 */
module.exports = {
  'event:hookEvent': 'myFunction'
}
```

```js
// Plugin implementation
module.exports = function () {
  this.hooks = require('./config/hooks.js');
  this.init = function (config, context, isDummy) {
    // do something
  }

  this.myFunction = function (message, event) {
    console.log('Event', event, 'is triggered');
    console.log('Here is the message', message);
  }
}
```

### Worker plugins

Every Hook plugin can be used as a Worker plugin, but Worker plugins can only be launched by the Server. If you set your configuration as `"loadedBy": "worker"`, the plugin will be ignored.  
You can convert a Hook plugin into a Worker plugin by adding a `threads` attribute to your plugin definition:

```json
{
    "path": "/var/kuzzle-plugin-very-useful",
    "defaultConfig": {
      "loadedBy": "server",
      "threads": 2
    },
    "activated": true
  }
```

The `threads` value correspond to the number of processes that will be launched.


### Pipe plugins

When a pipe event is triggered, we wait for all plugins attached to this event. A plugin attached to a pipe event has access to the data and can even change them.
A pipe plugin constructor must take in its last parameter a callback. This callback must be called at the end of the function with `callback(error, object)`:

* error: if there is an error during the function, this parameter must be set. If everything is ok, you can call the function with null.
* object: the object to pass to the next function.

Plugins are called in chain. When the `callback()` function is called, the next function attached on the event is triggered.  
If the plugin fails to call the callback before timeout, Kuzzle will raise an error and forward it to the requesting clients.

Pipe plugins are useful when you want to modify or validate an object.

```js
// Somewhere in Kuzzle
kuzzle.pluginsManager.trigger('event:pipeEvent', requestObject)
  .then(function (modifiedRequestObject) {
    // do something
  });
```

```js
// Plugin pipes configuration
module.exports = {
  'event:pipeEvent': 'addCreatedAt'
}
```

```js
// In main plugin index file
module.exports = function () {

  this.pipes = require('./config/pipes.js');
  this.init = function (config, context, isDummy) {
    // do something
  }

  this.addCreatedAt = function (requestObject, callback) {
    requestObject.data.body.createdAt = Date.now();
    callback(null, requestObject);
  }
}
```

In this example, in Kuzzle, the `modifiedRequestObject` has now a `createdAt` attribute.

### Controllers

A controller plugin is a plugin that adds new controller and actions to Kuzzle.
It must provide to Kuzzle:

__A `controllers` object listing one or more controllers:__

```js
// Plugin controller configuration
module.exports = {
  'mycontroller': 'MyController'
};
```

__A `routes` object listing the HTTP routes for the REST API:__

```js
// Plugin REST routes configuration
module.exports = [
  {verb: 'get', url: '/foo/:name', controller: 'mycontroller', action: 'myAction'},
  {verb: 'post', url: '/foo', controller: 'mycontroller', action: 'myAction'},
];
```

_NB: you can describe any routes you want, according to the actions you need to implement.<br>
For each action, you can declare either a GET action, or a POST action, or both of them._

__The controller code, implementing your actions:__

```js
// Controller implementation
module.exports = function MyController (context) {
  this.myAction = function (requestObject)
    var
      responseBody = {},
      response;

    // implement here the result of this controller action

    // Sample response object creation with the context variable:
    response = new context.ResponseObject(requestObject, responseBody);

    // the function must return a Promise:
    return Promise.resolve(response);
  };
};
```

```js
// Main plugin file
module.exports = function () {

  this.controllers = require('./config/controllers.js');
  this.routes = require('./config/routes.js');
  this.context = null;
  this.init = function (config, context, isDummy) {
    this.context = context;
    // do something
  };

  this.MyController = function () {
    MyController = require('./controllers/myController'),
    return new MyController(this.context);
  };
};
```

Notes:
* Action methods must return a promise.
* The controller constructor must use a "_context_" variable, which contains
some Kuzzle prototypes such as ResponseObject or KuzzleError,
which can be used by the controller actions.<br>
(see [List of injected prototypes](../lib/api/core/plugins/pluginsContext.js) ).


#### How it works

* With non-REST protocols, the _controller_ attribute is prefixed with the plugin name.

Sample:

```js
{
  controller: 'myplugin/mycontroller',
  action: 'myAction',
  body: {
    name: "John Doe"
  }
}
```

* With REST protocol, we use the routes configured in _routes.js_.  
These routes are automatically prefixed with "\_plugin/" + the plugin name.

Samples:

GET action:

```
GET http://kuzzle:7511/api/1.0/_plugin/myplugin/foo/John%20Doe
```

POST action:

```
POST http://kuzzle:7511/api/1.0/_plugin/myplugin/foo
{"name": "John Doe"}
```

### Protocol plugins

Kuzzle core only supports REST communications. All other supported protocols are implemented as protocol plugins.  
By default, the Kuzzle official docker image is shipped with the [Socket.io](https://github.com/kuzzleio/kuzzle-plugin-socketio) protocol.

#### How it works

Protocol plugins allow Kuzzle to support any existing protocol. These plugins ensure a two-way communication between clients and Kuzzle.  

Messages emanating from Kuzzle are emitted using the following hooks. Protocol plugins are free to ignore some or all of these hooks:

| Hook | Emitted object | Description                 |
|------|----------------|-----------------------------|
| ``protocol:joinChannel`` | `{channel, id}`| Tells protocol plugins that the connection `id` subscribed to the channel `channel` |
| ``protocol:leaveChannel`` | `{channel, id}` | Tells protocol plugins that the connection `id` left the channel `channel` |
| ``protocol:notify`` | `{channel, id, payload}` | Asks protocol plugins to emit a data `payload` to the connection `id`, on the channel `channel` |
| ``protocol:broadcast`` | `{channel, payload}` | Asks protocol plugins to emit a data `payload` to clients connected to the channel `channel` |

*For more information about channels, see our [API Documentation](http://kuzzleio.github.io/kuzzle-api-documentation/#on)*



Requests sent by clients to Kuzzle can be forwarded by protocol plugins using methods exposed in the plugin context.  
To access these methods, simply call ``context.getRouter().<router method>``:

| Router method | Arguments    | Returns | Description              |
|-----------------|--------------|---------|--------------------------|
| ``newConnection`` | ``protocol name`` (string) <br/>``connection ID`` (string) | A promise resolving to a ``context`` object | Declare a new connection to Kuzzle. |
| ``execute`` | ``optional JWT Headers`` (string)<br/>``RequestObject`` (object)<br/>``context`` (obtained with ``newConnection``)<br/>A node callback resolved with the request response |  | Execute a client request. |
| ``removeConnection`` | ``context`` (obtained with ``newConnection``) | | Asks Kuzzle to remove the corresponding connection and all its subscriptions |

#### Example

First, link protocol hooks to their corresponding implementation methods:
```js
// Content of a hooks.js file:
module.exports = {
  'protocol:broadcast': 'broadcast',
  'protocol:notify': 'notify',
  'protocol:joinChannel': 'join',
  'protocol:leaveChannel': 'leave'
};
```

Then, implement the corresponding methods:
```js
// Protocol plugin implementation
module.exports = function () {
  this.hooks = require('./hooks.js');
  // for instance, maintain client contexts in a global object
  this.contexts = {};

  this.init = function (config, context, isDummy) {
    // Protocol initialization. Usually opens a network port to listen to
    // incoming messages

    // whenever a client is connected
    context.getRouter().newConnection("this protocol name", "connection unique ID")
      .then(context => {
        this.contexts["connection unique ID"] = context;
      });

    // whenever a client sends a request
    context.getRouter().execute(null, requestObject, this.contexts["id"], (error, response) => {
      if (error) {
        // errors are encapsulated in a ResponseObject. You may simply
        // forward it to the client too
      } else {
        // forward the response to the client
      }
    });

    // whenever a client is disconnected
    context.getRouter().removeConnection(this.contexts["id"]);
  };

  this.broadcast = function (data) {
    /*
     Linked to the protocol:broadcast hook, emitted
     by Kuzzle when a "data.payload" needs to be broadcasted to the
     "data.channel" channel

     The payload is a ResponseObject
    */
  };

  this.notify = function (data) {
    /*
     Linked to the protocol:notify hook, emitted
     by Kuzzle when a "data.payload" needs to be emitted to the
     connection "data.id", on the channel "data.channel"

     The payload is a ResponseObject
    */
  };

  this.join = function (data) {
    /*
      Linked to the protocol:joinChannel hook, emitted  
      by Kuzzle when the connection "data.id" joins the
      channel "data.channel"
     */
  };

  this.leave = function (data) {
    /*
      Linked to the protocol:leaveChannel hook, emitted  
      by Kuzzle when the connection "data.id" leaves the
      channel "data.channel"
     */
  };
};
```

## Examples

* [kuzzle-plugin-logger](https://github.com/kuzzleio/kuzzle-plugin-logger)
* [kuzzle-plugin-helloworld](https://github.com/kuzzleio/kuzzle-plugin-helloworld)
* [kuzzle-plugin-socketio](https://github.com/kuzzleio/kuzzle-plugin-socketio)

# Troubleshooting

## Proxy

If you are using Docker and your network is behind a proxy, you may need to run this [container](https://hub.docker.com/r/klabs/forgetproxy/). This image lets other docker images accessing to external networks using the server proxy configuration.
