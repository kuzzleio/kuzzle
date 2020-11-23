---
code: false
type: page
title: Properties
description: Backend class properties
---

# Backend

The `Backend` class is the **entry point** of a Kuzzle application.  

It must be instantiated in order to create a new application.  

It gives access to the different features of the framework through its properties.

## `commit`

| Type              | Description                       |
|-------------------|-----------------------------------|
| <pre>string</pre> | Current GIT commit (if available) |

Contain the current GIT commit hash if the application is run from a GIT repository.  

The framework will try to go 3 level upper to find a valid GIT repository.

## `config`

This property allows to read or set the configuration values.  

See also [Configuration](/core/2/guides/advanced/8-configuration) guide.

### `config.content`

| Type                  | Description                  |
|-----------------------|------------------------------|
| <pre>JSONObject</pre> | Current Kuzzle configuration |

### `config.merge()`

Merges a configuration object into the current configuration.

::: info
This method can only be used before application startup.
:::

```ts
merge(config: JSONObject)
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `config` | <pre>JSONObject</pre> | Configuration object to merge |

**Usage:**

```js
app.config.merge({
  limits: {
    documentsWriteCount: 1000
  }
})
```

### `config.set()`

Sets a configuration value.

::: info
This method can only be used before application startup.
:::

```ts
set(path: string, value: any)
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `path` | <pre>string</pre> |  Path to the configuration key (lodash style) |
| `value` | <pre>any</pre> | Value for the configuration key |


**Usage:**

```js
app.config.set('limits.documentsWriteCount', 1000)
```

## `controller`

## `hook`

## `kerror`

## `log`

## `name`

## `pipe`

## `plugin`

## `sdk`

## `storage`

## `vault`

## `version`

| Property name   | Type                | Description                                                          |
|-----------------|---------------------|----------------------------------------------------------------------|
| `authenticated` | <pre>boolean</pre>  | Returns `true` if the SDK holds a valid token                        |
| `connected`     | <pre>boolean</pre>  | Returns `true` if the SDK is currently connected to a Kuzzle server. |
| `offlineQueue`  | <pre>object[]</pre> | Contains the queued requests during offline mode                     |
| `protocol`      | <pre>Protocol</pre> | Protocol used by the SDK                                             |
