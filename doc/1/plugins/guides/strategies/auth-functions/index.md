---
code: false
type: page
title: Authentication methods
order: 1
---

### Methods

The `methods` part of the `strategies` object can contain the following properties:

| Arguments       | Type              | Description                                                                                                                        |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `create`        | <pre>string</pre> | The name of the exposed [create](/core/1/plugins/guides/strategies/auth-functions#create) function                                   |
| `delete`        | <pre>string</pre> | The name of the exposed [delete](/core/1/plugins/guides/strategies/auth-functions#delete) function                                   |
| `exists`        | <pre>string</pre> | The name of the exposed [exists](/core/1/plugins/guides/strategies/auth-functions#exists) function                                   |
| `update`        | <pre>string</pre> | The name of the exposed [update](/core/1/plugins/guides/strategies/auth-functions#update) function                                   |
| `validate`      | <pre>string</pre> | The name of the exposed [validate](/core/1/plugins/guides/strategies/auth-functions#update) function                                 |
| `verify`        | <pre>string</pre> | The name of the exposed [verify](/core/1/plugins/guides/strategies/auth-functions#verify) function                                   |
| `afterRegister` | <pre>string</pre> | (optional) The name of the exposed [afterRegister](/core/1/plugins/guides/strategies/auth-functions#optional-afterregister) function |
| `getById`       | <pre>string</pre> | (optional) The name of the exposed [getById](/core/1/plugins/guides/strategies/auth-functions#optional-getbyid) function             |
| `getInfo`       | <pre>string</pre> | (optional) The name of the exposed [getInfo](/core/1/plugins/guides/strategies/auth-functions#optional-getinfo) function             |

Even though each strategy must declare its own set of properties, the same strategy method can be used by multiple strategies.

---

## create

The `create` function adds credentials to a user.

For security reasons, plugins are entirely responsible of how credentials are managed, storage included: Kuzzle does not read, modify, or store credentials.

If needed, Kuzzle exposes a secure and isolated storage space for each plugin. It can be accessed using the [Repository](/core/1/plugins/plugin-context/constructors/repository) constructor.

### Arguments

```js
create(request, credentials, kuid, strategy);
```

<br/>

| Arguments     | Type                                                           | Description                                                                                      |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `request`     | [`Request`](/core/1/plugins/constructors/request) | API request asking for the credentials creation                                                  |
| `credentials` | <pre>object</pre>                                              | New credentials to create, already validated by this strategy's [validate](#validate) function   |
| `kuid`        | <pre>string</pre>                                              | User's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid) |
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
| `request`  | [`Request`](/core/1/plugins/constructors/request) | API request asking for the credentials deletion                                                  |
| `kuid`     | <pre>string</pre>                                              | User's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid) |
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
| `request`  | [`Request`](/core/1/plugins/constructors/request) | Source API request                                                                               |
| `kuid`     | <pre>string</pre>                                              | User's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid) |
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
| `request`     | [`Request`](/core/1/plugins/constructors/request) | Source API request                                                                                     |
| `credentials` | <pre>object</pre>                                              | Updated credentials.<br/>Those are already validated by this strategy's [validate](#validate) function |
| `kuid`        | <pre>string</pre>                                              | User's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid)       |
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
| `request`     | [`Request`](/core/1/plugins/constructors/request) | Source API request                                                                                                                                                                          |
| `credentials` | <pre>object</pre>                                              | Credentials to validate                                                                                                                                                                     |
| `kuid`        | <pre>string</pre>                                              | User's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid)                                                                                            |
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
| `original` | [`Request`](/core/1/plugins/constructors/request) | Source API login request                                                        |
| `query`    | <pre>object</pre>                                              | Direct link to `original.input.args`, containing the optional request arguments |
| `body`     | <pre>object</pre>                                              | Direct link to `original.input.body`, containing the request body content       |

### Returned value

The `verify` function must return a promise, resolving to an object with the following properties:

<br/>

| Properties | Type              | Description                                                                                                                                                                                              |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kuid`     | <pre>string</pre> | If the authentication succeeds, this property must be set to the user's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid). Otherwise, this must be set to `null` |
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

The `getById` function returns credentials information using the authentication strategy's user identifier (which may not be the [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid)).

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
| `request`  | [`Request`](/core/1/plugins/constructors/request) | The API request asking for credentials information |
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
| `request`  | [`Request`](/core/1/plugins/constructors/request) | The API request asking for credentials information                                               |
| `kuid`     | <pre>string</pre>                                              | User's [kuid](/core/1/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid) |
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
