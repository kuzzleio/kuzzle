---
code: false
type: page
title: Properties
description: Backend class properties
---

<SinceBadge version="2.8.0" />

# Properties

## `cluster`

This property is an instance of the [BackendCluster](/core/2/framework/classes/backend-cluster) class that allows to interact with cluster nodes.

| Type                                                                         | Description                |
|------------------------------------------------------------------------------|----------------------------|
| <pre>[BackendCluster](/core/2/framework/classes/backend-cluster)</pre> | BackendCluster instance |


## `commit`

| Type              | Description                       |
|-------------------|-----------------------------------|
| <pre>string</pre> | Current GIT commit (if available) |

Contains the current GIT commit hash if the application is run from a GIT repository.

The framework will try to go 3 level upper to find a valid GIT repository.

## `config`

This property is an instance of the [BackendConfig](/core/2/framework/classes/backend-config) class that allows to read or set the configuration values.

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[BackendConfig](/core/2/framework/classes/backend-config)</pre> | BackendConfig instance |

See also the [Configuration](/core/2/guides/advanced/configuration) guide.

## `controller`

This property is an instance of the [BackendController](/core/2/framework/classes/backend-controller) class that allows to use or register API controllers.

| Type                                                                         | Description                |
|------------------------------------------------------------------------------|----------------------------|
| <pre>[BackendController](/core/2/framework/classes/backend-controller)</pre> | BackendController instance |

See also the [API Controllers](/core/2/guides/develop-on-kuzzle/api-controllers) guide.

## `hook`

This property is an instance of the [BackendHook](/core/2/framework/classes/backend-hook) class that allows to register hooks.

| Type                                                             | Description          |
|------------------------------------------------------------------|----------------------|
| <pre>[BackendHook](/core/2/framework/classes/backend-hook)</pre> | BackendHook instance |

See also the [Event System](/core/2/guides/develop-on-kuzzle/event-system#hook) guide.

## `import`

This property is an instance of the [BackendImport](/core/2/framework/classes/backend-import) class that allows to import mappings and security configuration.

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[BackendImport](/core/2/framework/classes/backend-import)</pre> | BackendImport instance |

<!--

@todo Document this property once the ErrorManager has been converted to TS
## `kerror`

-->

## `log`

This property is an instance of the [BackendLog](/core/2/framework/classes/internal-logger) class that allows to log messages using Kuzzle's internal logger.

| Type                                                              | Description         |
|-------------------------------------------------------------------|---------------------|
| <pre>[BackendLog](/core/2/framework/classes/internal-logger)</pre> | BackendLog instance |

See also the [Internal Logger](/core/2/guides/advanced/internal-logger) guide.

## `name`

Application name.

| Type              | Description      |
|-------------------|------------------|
| <pre>string</pre> | Application name |

## `pipe`

This property is an instance of the [BackendPipe](/core/2/framework/classes/backend-pipe) class that allows to register pipes.

| Type                                                             | Description          |
|------------------------------------------------------------------|----------------------|
| <pre>[BackendPipe](/core/2/framework/classes/backend-pipe)</pre> | BackendPipe instance |

See also the [Event System](/core/2/guides/develop-on-kuzzle/event-system#pipe) guide.

## `plugin`

This property is an instance of the [BackendPlugin](/core/2/framework/classes/backend-plugin) class that allows to add plugins to the application.

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[BackendPlugin](/core/2/framework/classes/backend-plugin)</pre> | BackendPlugin instance |

See also the [Plugins](/core/2/guides/develop-on-kuzzle/external-plugins) guide.

## `sdk`

This property is an instance of the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) class that allows to interact with the Kuzzle API.

| Type                                                             | Description          |
|------------------------------------------------------------------|----------------------|
| <pre>[EmbeddedSDK](/core/2/framework/classes/embedded-sdk)</pre> | EmbeddedSDK instance |

See also the [Embedded SDK](/core/2/guides/develop-on-kuzzle/embedded-sdk) guide.

## `storage`

This property is an instance of the [BackendStorage](/core/2/framework/classes/backend-storage) class that allows to interact directly with Elasticsearch.

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>[BackendStorage](/core/2/framework/classes/backend-storage)</pre> | BackendStorage instance |

See also the [Data Storage](/core/2/guides/main-concepts/data-storage#integrated-elasticsearch-client) guide.

## `vault`

This property is an instance of the [BackendVault](/core/2/framework/classes/backend-vault) class that allows to use the secrets vault.

| Type                                                               | Description           |
|--------------------------------------------------------------------|-----------------------|
| <pre>[BackendVault](/core/2/framework/classes/backend-vault)</pre> | BackendVault instance |

See also the [Secrets Vault](/core/2/guides/advanced/secrets-vault) guide.

## `version`

Application version. This value will be read from the `package.json` if available.

| Type              | Description         |
|-------------------|---------------------|
| <pre>string</pre> | Application version |
