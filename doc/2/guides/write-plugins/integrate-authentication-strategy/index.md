---
code: false
type: page
title: Authentication Strategy
description: Learn how to integrate new authentication strategy
order: 300
---

# Authentication Strategy

Plugins can add new authentication strategies to Kuzzle.
For example, our official [OAUTH2 Authentication plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-oauth) adds OAUTH2 support to Kuzzle.

All authentication strategies supported by [Passport.js](http://passportjs.org) can be integrated to Kuzzle.

---

## Exposing authenticators

[Passport.js](http://passportjs.org) provides a wide range of authentication strategies.
Custom authentication strategies can also be implemented by subclassing the abstract [Passport Strategy](https://github.com/jaredhanson/passport-strategy) class.

To register strategies to Kuzzle, a `authenticators` object property must be exposed by the plugin, for instance:

```js
this.authenticators = {
  Local: require('passport-local'),
  Oauth2: require('passport-oauth2')
};
```

---

## Credentials security

User credentials are very sensitive data, and these must be properly isolated to prevent security vulnerabilities.
To do so, Kuzzle guarantees that it never interprets, modifies, or stores credentials information.

Instead, Kuzzle:

- provides a global user unique identifier (referred from now on as the user's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid), giving the possibility to a user to authenticate with multiple strategies
- entrusts implemented strategies with credentials protection, validation, verification and storage

---

There are two ways of registering new strategies:

- statically, by exposing a `strategies` object
- dynamically, by using the dedicated [PluginContextAccessors.strategies](/core/2/framework/classes/plugin-context-accessors/properties#strategies) methods

Whether strategies are added statically or dynamically, the registered strategy must expose the following properties:

| Arguments | Type              | Description                           |
| --------- | ----------------- | ------------------------------------- |
| `config`  | <pre>object</pre> | Authentication strategy configuration |
| `methods` | <pre>object</pre> | List of exposed methods               |

## Statically register strategies

Plugins can declare a `strategies` object which contains the authentication strategies to register.  
This object will be interpreted by Kuzzle only once, immediately after this plugin's init function has resolved.  
Each key of this object is the name of the strategy to register and the value is the strategy object containing `config` and `methods` properties.  

For example, to register a strategy named `local` with the `Local` authenticator:
```js
this.authenticators = {
  Local: require('passport-local')
};

this.strategies = {
  local: {
    config: {
      authenticator: 'Local'
    },
    // these methods must be exposed by the plugin 
    methods: {
      create: 'create',
      delete: 'delete',
      exists: 'exists',
      getById: 'getById',
      getInfo: 'getInfo',
      update: 'update',
      validate: 'validate',
      verify: 'verify'
    }
  }
}
```

## Dynamically register strategies

Strategies can be register at runtime with the [PluginStrategy.add](/core/2/framework/classes/plugin-strategy/add) method.  

::: info
Strategies added dynamically in the plugin's [init method](/core/2/guides/write-plugins/start-writing-plugins#init-method) are added to the static `strategies` object and loaded by Kuzzle after the plugin initialization.
:::

### config

The `config` part of the `strategies` object can contain the following properties:

| Arguments             | Type                | Description                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authenticator`       | <pre>string</pre>   | One of the exposed [authenticators](#exposing-authenticators) name                                                                                                                                                                                                                        |
| `authenticateOptions` | <pre>object</pre>   | (optional) Additional options to be provided to the Passport's [authenticate method](http://passportjs.org/docs/authenticate)                                                                                                                                                                                                                         |
| `fields`              | <pre>string[]</pre> | (optional) The list of accepted field names by the strategy credentials.<br/>The list is informative only, meant to be used by the [getAllCredentialFields](/core/2/api/controllers/security/get-all-credential-fields) and the [getCredentialFields](/core/2/api/controllers/security/get-credential-fields) API methods |
| `strategyOptions`     | <pre>object</pre>   | (optional) Options provided to the Passport.js strategy constructor                                                                                                                                                                                                                                                                                   |
## Strategy Methods

The `methods` part of the `strategies` object can contain the following properties:

| Arguments       | Type              | Description                                                                                                                        |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `create`        | <pre>string</pre> | The name of the exposed [create](#create) function                                   |
| `delete`        | <pre>string</pre> | The name of the exposed [delete](#delete) function                                   |
| `exists`        | <pre>string</pre> | The name of the exposed [exists](#exists) function                                   |
| `update`        | <pre>string</pre> | The name of the exposed [update](#update) function                                   |
| `validate`      | <pre>string</pre> | The name of the exposed [validate](#update) function                                 |
| `verify`        | <pre>string</pre> | The name of the exposed [verify](#verify) function                                   |
| `afterRegister` | <pre>string</pre> | (optional) The name of the exposed [afterRegister](#optional-afterregister) function |
| `getById`       | <pre>string</pre> | (optional) The name of the exposed [getById](#optional-getbyid) function             |
| `getInfo`       | <pre>string</pre> | (optional) The name of the exposed [getInfo](#optional-getinfo) function             |

Even though each strategy must declare its own set of properties, the same strategy method can be used by multiple strategies.

---

## create

The `create` function adds credentials to a user.

For security reasons, plugins are entirely responsible of how credentials are managed, storage included: Kuzzle does not read, modify, or store credentials.

If needed, Kuzzle exposes a secure and isolated storage space for each plugin. It can be accessed using the [Repository](/core/2/framework/classes/repository/constructor) constructor.

### Arguments

```js
create(request, credentials, kuid, strategy);
```

<br/>

| Arguments     | Type                                                           | Description                                                                                      |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `request`     | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | API request asking for the credentials creation                                                  |
| `credentials` | <pre>object</pre>                                              | New credentials to create, already validated by this strategy's [validate](#validate) function   |
| `kuid`        | <pre>string</pre>                                              | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid) |
| `strategy`    | <pre>string</pre>                                              | Authentication strategy used by these credentials                                                |

### Returned value

The `create` function must return a promise, resolving to an object. The content of that object depends on this authentication strategy; usually a feedback about the created credentials is expected. That object can be left empty.

:::warning
The object resolved by the promise is directly forwarded to the originating user. For security reasons, it must only contain *non sensitive* information.
:::

---

## delete

The `delete` function deletes a user's credentials.

### Arguments

```js
delete (request, kuid, strategy);
```

<br/>

| Arguments  | Type                                                           | Description                                                                                      |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `request`  | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | API request asking for the credentials deletion                                                  |
| `kuid`     | <pre>string</pre>                                              | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid) |
| `strategy` | <pre>string</pre>                                              | Authentication strategy name                                                                     |

### Returned value

The `delete` function must return a promise. The resolved value is not used.

---

## exists

The `exists` function checks whether a user is known to the authentication strategy.

### Arguments

```js
exists(request, kuid, strategy);
```

<br/>

| Arguments  | Type                                                           | Description                                                                                      |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `request`  | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | Source API request                                                                               |
| `kuid`     | <pre>string</pre>                                              | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid) |
| `strategy` | <pre>string</pre>                                              | Authentication strategy name                                                                     |

### Returned value

The `exists` function must return a promise, resolving to a boolean representing the result of the user existence check.

---

## update

The `update` function updates a user's credentials.

### Arguments

```js
update(request, credentials, kuid, strategy);
```

<br/>

| Arguments     | Type                                                           | Description                                                                                            |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `request`     | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | Source API request                                                                                     |
| `credentials` | <pre>object</pre>                                              | Updated credentials.<br/>Those are already validated by this strategy's [validate](#validate) function |
| `kuid`        | <pre>string</pre>                                              | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid)       |
| `strategy`    | <pre>string</pre>                                              | Authentication strategy name                                                                           |

### Returned value

The `update` function must return a promise, resolving to an object. The content of that object depends on this authentication strategy; usually a feedback about the updated credentials is expected. That object can be left empty.

:::warning
The object resolved by the promise is directly forwarded to the originating user. For security reasons, it must only contain *non sensitive* information.
:::

---

## validate

The `validate` function verifies that credentials are well-formed.

### Arguments

```js
validate(request, credentials, kuid, strategy, isUpdate);
```

<br/>

| Arguments     | Type                                                           | Description                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request`     | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | Source API request                                                                                                                                                                          |
| `credentials` | <pre>object</pre>                                              | Credentials to validate                                                                                                                                                                     |
| `kuid`        | <pre>string</pre>                                              | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid)                                                                                            |
| `strategy`    | <pre>string</pre>                                              | Authentication strategy name                                                                                                                                                                |
| `isUpdate`    | <pre>boolean</pre>                                             | Tells whether the request is a credentials update. In the case of an update, the `credentials` object may only contain changes to be applied, instead of a complete credentials description |

### Returned value

The function `validate` must return a promise. The resolved value, if there is one, is ignored.

---

## verify

The [verify](http://passportjs.org/docs/configure) function authenticates a user.

The number of arguments taken by the `verify` function depends on the authentication strategy.
For instance, a `local` authentication strategy requires that the `verify` function validates both a user name and a password, so these two arguments will have to be provided to the `verify` function.

### Arguments

```js
verify(payload, ...)
```

<br/>

| Arguments | Type              | Description                                                  |
| --------- | ----------------- | ------------------------------------------------------------ |
| `payload` | <pre>object</pre> | Login request made to passport                               |
| `...`     | <pre>\*</pre>     | Additional arguments; depends on the authentication strategy |

#### payload

The `payload` object has the following properties:

<br/>

| Properties | Type                                                           | Description                                                                     |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `original` | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | Source API login request                                                        |
| `query`    | <pre>object</pre>                                              | Direct link to `original.input.args`, containing the optional request arguments |
| `body`     | <pre>object</pre>                                              | Direct link to `original.input.body`, containing the request body content       |

### Returned value

The `verify` function must return a promise, resolving to an object with the following properties:

<br/>

| Properties | Type              | Description                                                                                                                                                                                              |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kuid`     | <pre>string</pre> | If the authentication succeeds, this property must be set to the user's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid). Otherwise, this must be set to `null` |
| `message`  | <pre>string</pre> | If `kuid` is set to `null` (authentication failed), this optional property can be set with a rejection reason                                                                                            |

:::info
A failed authentication is not an error. The returned promise should only be rejected if an actual error occurs.
:::

---

## (optional) afterRegister

The `afterRegister` function is called when the Passport.js strategy is instantiated by Kuzzle.

### Arguments

```js
afterRegister(strategyInstance);
```

<br/>

| Arguments          | Type              | Description                       |
| ------------------ | ----------------- | --------------------------------- |
| `strategyInstance` | <pre>object</pre> | The Passport.js strategy instance |

---

## (optional) getById

The `getById` function returns credentials information using the authentication strategy's user identifier (which may not be the [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid)).

If this function is not implemented, an empty object is returned by Kuzzle instead.

:::warning
The returned information can be forwarded to users. For security reasons, it must only contain *non sensitive* information.
:::

### Arguments

```js
getById(request, id, strategy);
```

<br/>

| Arguments  | Type                                                           | Description                                        |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `request`  | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | The API request asking for credentials information |
| `id`       | <pre>string</pre>                                              | Strategy's user identifier                         |
| `strategy` | <pre>string</pre>                                              | Authentication strategy name                       |

### Returned value

The `getById` function must return a promise, resolving to an object containing credentials information. It can be left empty.

---

## (optional) getInfo

The `getInfo` function returns information about a user's credentials.

If this function is not implemented, an empty object is returned by Kuzzle instead.

:::warning
The returned information can be forwarded to users. For security reasons, it must only contain *non sensitive* information.
:::

### Arguments

```js
getInfo(request, kuid, strategy);
```

<br/>

| Arguments  | Type                                                           | Description                                                                                      |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `request`  | [KuzzleRequest](/core/2/framework/classes/kuzzle-request) | The API request asking for credentials information                                               |
| `kuid`     | <pre>string</pre>                                              | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid-kuid) |
| `strategy` | <pre>string</pre>                                              | Authentication strategy name                                                                     |

### Returned value

The `getInfo` function must return a promise, resolving to an object containing credentials information. It can be left empty.

---

## Example

```js
module.exports = class AuthenticationPlugin {
  constructor() {}

  /**
    Required plugin initialization function
    (see the "Plugin prerequisites" section)
   */
  init (customConfig, context) {
    this.authenticators = {
      StrategyConstructor: require('some-passport-strategy')
    };

    this.strategies = {
      '<strategy name>': {
        config: {
          // Must be declared in this.authenticators
          authenticator: 'StrategyConstructor',

          // The list of fields that have to be provided in the credentials
          fields: ['login', 'password']
        },
        methods: {
          create: 'create',
          delete: 'delete',
          exists: 'exists',
          update: 'update',
          validate: 'validate',
          verify: 'verify'
        }
      }
    };
  }

  /**
   * Stores the provided credentials
   * Must keep a link between the persisted credentials
   * and the kuid
   */
  create (request, credentials, kuid) {
    // store credentials
    return Promise.resolve({/* non sensitive credentials info */});
  }

  /**
   * Removes the user's stored credentials from
   * the plugin persistence layer
   */
  delete (request, kuid) {
    // remove credentials
    return Promise.resolve();
  }

  /**
   * Checks if user's credentials exist in the persistence layer
   */
  exists (request, kuid) {
    // check credentials existence
    return Promise.resolve(/* boolean value *);
  }

  /**
   * Updates the user's credentials information in the
   * persistence layer
   *
   * @param {KuzzleRequest} request
   * @param {object} credentials
   * @param {string} kuid
   * @returns {Promise<object>}
   */
  update (request, credentials, kuid) {
    // update credentials
    return Promise.resolve(/* non sensitive credentials info *);
  }

  /**
   * Validates credentials against the strategy rules
   * (required fields, password strength, username uniqueness, ...)
   */
  validate (request, credentials, kuid, strategy, isUpdate) {
    // validate credentials
    return Promise.resolve(/* true|false *);
  }

  /**
   * Returns an object with the authenticated user id if successful,
   * and a reason if the authentication fails
   */
  verify (request, ...credentials) {
    const kuid = /* authentification */;

    if (kuid) {
      return Promise.resolve({kuid});
    }

    return Promise.resolve({
      kuid: null,
      message: 'Login failed - You shall not pass! Reason: ...'
    });
  }
}
```
