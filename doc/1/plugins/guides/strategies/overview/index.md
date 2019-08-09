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

## Registering authentication strategies

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

- provides a global user unique identifier (referred from now on as the user's [kuid](/core/1/guides/kuzzle-depth/authentication/#the-kuzzle-user-identifier-kuid)), giving the possibility to a user to authenticate with multiple strategies
- entrusts implemented strategies with credentials protection, validation, verification and storage

---

## Managing credentials

There are two ways of interfacing credentials management:

- statically, by exposing a `strategies` object
- dynamically, by using the dedicated [strategy accessors](/core/1/plugins/plugin-context/accessors/strategies)

Whether strategies are added statically or dynamically, the `strategies` object must expose the following properties:

| Arguments | Type              | Description                           |
| --------- | ----------------- | ------------------------------------- |
| `config`  | <pre>object</pre> | Authentication strategy configuration |
| `methods` | <pre>object</pre> | List of exposed methods               |

### config

The `config` part of the `strategies` object can contain the following properties:

| Arguments             | Type                | Description                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authenticator`       | <pre>string</pre>   | One of the exposed [authenticators](/core/1/plugins/guides/strategies/overview/#registering-authentication-strategies) name                                                                                                                                                                                                                        |
| `constructor`         | <pre>object</pre>   | <DeprecatedBadge version="1.4.0" /> (use the `authenticator` property instead)<br/>The constructor of the Passport.js strategy. Does not support [dynamic strategy registration](/core/1/plugins/plugin-context/accessors/strategies)                                                                                                                                |
| `authenticateOptions` | <pre>object</pre>   | (optional) Additional options to be provided to the Passport's [authenticate method](http://passportjs.org/docs/authenticate)                                                                                                                                                                                                                         |
| `fields`              | <pre>string[]</pre> | (optional) The list of accepted field names by the strategy credentials.<br/>The list is informative only, meant to be used by the [getAllCredentialFields](/core/1/api/controllers/security/get-all-credential-fields/) and the [getCredentialFields](/core/1/api/controllers/security/get-credential-fields) API methods |
| `strategyOptions`     | <pre>object</pre>   | (optional) Options provided to the Passport.js strategy constructor                                                                                                                                                                                                                                                                                   |
