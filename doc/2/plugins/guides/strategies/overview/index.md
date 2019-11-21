---
code: false
type: page
title: Overview
order: 0
---

# Strategies

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

- provides a global user unique identifier (referred from now on as the user's [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier-kuid)), giving the possibility to a user to authenticate with multiple strategies
- entrusts implemented strategies with credentials protection, validation, verification and storage

---

There are two ways of registering new strategies:

- statically, by exposing a `strategies` object
- dynamically, by using the dedicated [strategy accessors](/core/2/plugins/plugin-context/accessors/strategies)

Whether strategies are added statically or dynamically, the registered strategy must expose the following properties:

| Arguments | Type              | Description                           |
| --------- | ----------------- | ------------------------------------- |
| `config`  | <pre>object</pre> | Authentication strategy configuration |
| `methods` | <pre>object</pre> | List of exposed methods               |

### statically register strategies

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

### dynamically register strategies

Strategies can be register at runtime with the [strategies.add](/core/1/plugins/plugin-context/accessors/strategies/#add) method.  

::: info
Strategies added dynamically in the plugin's [init method](/core/1/plugins/guides/manual-setup/init-function/) are added to the static `strategies` object and loaded by Kuzzle after the plugin initialization.
:::

### config

The `config` part of the `strategies` object can contain the following properties:

| Arguments             | Type                | Description                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authenticator`       | <pre>string</pre>   | One of the exposed [authenticators](/core/2/plugins/guides/strategies/overview#registering-authentication-strategies) name                                                                                                                                                                                                                        |
| `authenticateOptions` | <pre>object</pre>   | (optional) Additional options to be provided to the Passport's [authenticate method](http://passportjs.org/docs/authenticate)                                                                                                                                                                                                                         |
| `fields`              | <pre>string[]</pre> | (optional) The list of accepted field names by the strategy credentials.<br/>The list is informative only, meant to be used by the [getAllCredentialFields](/core/2/api/controllers/security/get-all-credential-fields) and the [getCredentialFields](/core/2/api/controllers/security/get-credential-fields) API methods |
| `strategyOptions`     | <pre>object</pre>   | (optional) Options provided to the Passport.js strategy constructor                                                                                                                                                                                                                                                                                   |
