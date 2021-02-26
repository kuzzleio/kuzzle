---
code: false
type: page
title: Authentication
description: Authenticate your users through the multi-strategy system
order: 500
---

# Authentication

Kuzzle handles authentication in a **generic way with a strategy system** that can be added via plugins.

These strategies are responsible for **managing user credentials** and **verifying them** during the authentication phase.

::: info
Plugins have a secure storage space accessible only from the plugin code.  
This space is used to store sensitive information such as user credentials.    
Learn more about [Writing Plugins](/core/2/guides/write-plugins/start-writing-plugins).  
:::

Each user can then use one of the available strategies to authenticate himself.

## Kuzzle User IDentifier (kuid)

Users are identified by a unique identifier called the Kuzzle User IDentifier or `kuid`.  

This is for example the `kuid` found in the [Kuzzle Metadata](/core/2/guides/main-concepts/data-storage#kuzzle-metadata) of documents:

```json
{
  "name": "jenow",
  "age": 32,
  "_kuzzle_info": {
    "creator": "c2eaced2-c388-455a-b018-940b68cbb5a2",
    "createdAt": 1605018219330,
    "updater": "940b940b6-c388-554a-018b-ced28cbb5a2",
    "updatedAt": 1705018219330
  }
}
```

The `kuid` is auto-generated unless it is passed to the [security:createUser](/core/2/api/controllers/security/create-user) API action:

```bash
kourou security:createUser '{           
  content: {    
    profileIds: ["default"]
  },                    
  credentials: {          
    local: {
      username: "my",
      password: "password"
    }
  }
}' --id mylehuong
```

::: info
Most of the [security](/core/2/api/controllers/security) controller actions use the `kuid` to identify users.
:::

## Credentials

In Kuzzle, user credentials are composed of a **list of authentication strategies and their respective profile data**.

They must be provided at the creation of a user in the `credentials` property of the user's content passed in the `body` of the query.

**Example:** _Create an user with `local` credentials_
```bash
kourou security:createUser '{
  content: {
    profileIds: ["default"]
  },
  credentials: {
    local: {
      username: "mylehuong",
      password: "password"
    }
  }
}'
```

They will then be **stored by the plugin** in charge of the `local` strategy in a **secure storage space** accessible only from the plugin's scope.

It is possible to manipulate a user's credentials:
 - [security:getCredentials](/core/2/api/controllers/security/get-credentials): retrieve credentials information for a strategy
 - [security:createCredentials](/core/2/api/controllers/security/create-credentials): create new credentials for another strategy
 - [security:deleteCredentials](/core/2/api/controllers/security/delete-credentials): delete credentials for a strategy

When a user wants to authenticate to Kuzzle, they must choose a strategy and then provide the information requested by it.

For instance, the `local` strategy requires a `username` and a `password`:

```bash
kourou auth:login -a strategy=local --body '{
  username: "mylehuong",
  password: "password"
}'
```

## Authentication Token

Authentication is performed using the [auth:login](/core/2/api/controllers/auth/login) API action.  

This action requires the name of the strategy to be used as well as any information necessary for this strategy.

When authentication is successful, **Kuzzle returns an authentication token**. This token has a validity of 1 hours by default, then it will be necessary to ask for a new one with either [auth:refreshToken](/core/2/api/controllers/auth/refresh-token) or [auth:login](/core/2/api/controllers/auth/login).

::: info
It is possible to request an authentication token valid for more than 1 hours with the argument `expiresIn`.  
The default validity period is configurable under the key `security.jwt.expiresIn`.  
It is also possible to set a maximum validity period for a token under the key `security.jwt.maxTTL`.
:::


:::: tabs

::: tab HTTP

The authentication token must be provided in the `Authorization` header: `Authorization: Bearer <token>`.

:::

::: tab Others

The authentication token must be provided in the payload with the `jwt` property:

```js
{
  controller: "<controller>",
  action: "<action>",
  jwt: "<token>",
}
```

:::

::::

::: warning
For historical reasons the API terminology uses the term `jwt` but Kuzzle authentication tokens only have in common with JSON Web Tokens the algorithms used to generate and verify them.
:::

Authentication tokens are revocable using the [auth:logout](/core/2/api/controllers/auth/logout) API action.

::: info
It's also possible to revoke every authentication tokens of a user with the [security:revokeTokens](/core/2/api/controllers/security/revoke-tokens/).
:::

### Authentication Token Expiration

**Authentication tokens expire after a defined period of time**. Once an authentication token has expired, it **cannot be used in any way**.  

::: info
If the customer has subscribed to real-time notifications then they will be notified at the time of expiration with a [TokenExpired server notification](/core/2/api/payloads/notifications#server-notification).
:::

While an authentication token is still valid, it is possible to provide it to the [auth:refreshToken](/core/2/api/controllers/auth/refresh-token) API action to request a new, fresher authentication token, without having to ask for credentials. 

## `local` Strategy

The `local` strategy allows users to authenticate with a `username` and a `password`.  

Those information must be passed to the [auth:login](/core/2/api/controllers/auth/login) API action body:
```bash
kourou auth:login -a strategy=local --body '{
  username: "mylehuong",
  password: "password"
}'
```

<SinceBadge version="2.10.0"/>
### Authentication Token in the Browser

When you're sending HTTP requests from a browser you can instruct Kuzzle
to `load` and `store` authentication tokens within an [HTTP Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies).
This is possible thanks to the option [cookieAuth](/core/2/api/protocols/http#cookieAuth) in [auth:login](/core/2/api/controllers/auth/login), [auth:logout](/core/2/api/controllers/auth/logout), [auth:checkToken](/core/2/api/controllers/auth/checkToken), [auth:refreshToken](/core/2/api/controllers/auth/refresh-token)

::: warning
This only works if the option `http.accessControlAllowOrigin` is not defined to `*` in the [Kuzzle Configuration](/core/2/guides/advanced/configuration)
:::


### `local` Strategy Configuration

The strategy can be configured under the `plugins.kuzzle-plugin-auth-passport-local` configuration key.

```js
{
  "plugins": {
    // [...]

    "kuzzle-plugin-auth-passport-local": {

      // one of the supported encryption algorithms
      // (run crypto.getHashes() to get the complete list).
      "algorithm": "sha512",
      
      // boolean and controlling if the password is stretched or not.
      "stretching": true,

      // describes how the hashed password is stored in the database
      // https://nodejs.org/api/buffer.html#buffer_buf_tostring_encoding_start_end
      "digest": "hex",

      // determines whether the hashing algorithm uses crypto.createHash (hash)
      // or crypto.createHmac (hmac).
      // https://nodejs.org/api/crypto.html
      "encryption": "hmac",

      // if true, kuzzle will refuse any credentials update or deletion,
      // unless the currently valid password is provided
      // or if the change is performed via the security controller
      "requirePassword": false,

      // a positive time representation of the delay after which a
      // reset password token expires (see ms for possible formats).
      "resetPasswordExpiresIn": -1, 

      // set of additional rules to apply to users, or to groups of users
      "passwordPolicies": []
    }
  }
}
```

### Password Policies

Password policies can be used to define a **set of additional rules to apply to users**, or to groups of users.

Each password policy is an object with the following properties:

* `appliesTo`: (mandatory). can be either set to the `*` to match all users, or an object.
* `appliesTo.users`: an array of user `kuids` the policy applies to.
* `appliesTo.profiles`: an array of `profile` ids the policy applies to.
* `appliesTo.roles`: an array of `role` ids the policy applies to.

::: info
At least one of `users`, `profiles` or `roles` properties must be set if `appliesTo` is an object.
:::

### Optional properties

* `expiresAfter`: the delay after which a password expires (see [ms](https://www.npmjs.com/package/ms) for possible formats). Users with expired passwords are given a `resetPasswordToken` when logging in and must change their password to be allowed to log in again.
* `forbidLoginInPassword`: if set to `true`, prevents users to use their username in part of the password. The check is case-**in**sensitive.
* `forbidReusedPasswordCount`: the number of passwords to store in history and checked against when a new password is set to prevent passwords reuse.
* `mustChangePasswordIfSetByAdmin`: if set to `true`, whenever a password is set for a user by someone else, that user will receive a `resetPasswordToken` upon their next login and they will have to change their password before being allowed to log in again.
* `passwordRegex`: a string representation of a regular expression to test on new passwords.

**Example:**

_No user can use a password that includes the login and the password must be at least 6 chars long._

_Editors and admin users passwords expire every 30 days and the password must be at least 8 chars long and include at least one letter and one digit._

_Admin users passwords must either be 24 or more chars long, or include a lower case char, an upper case char, a digit and a special char._

```json
{
  "passwordPolicies": [
    {
      "appliesTo": "*",
      "forbidLoginPassword": true,
      "passwordRegex": ".{6,}"
    },
    {
      "appliesTo": {
        "profiles": ["editor"],
        "roles": ["admin"]
      },
      "expiresAfter": "30d",
      "mustChangePasswordIfSetByAdmin": true,
      "passwordRegex": "^(?=.*[a-zA-Z])(?=.*[0-9])(?=.{8,})"
    },
    {
      "appliesTo": {
        "roles": ["admin"]
      },
      "passwordRegex": "^(((?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*\\W)(?=.{8,}))|(?=.{24,}))"
    }
  ]
}
```

## `oauth` Strategy

This plugin allows to authenticate with OAuth providers such as Facebook, Twitter, etc by using [Passport.js OAuth2](http://www.passportjs.org/docs/oauth2-api/).

This plugin is not shipped by default with Kuzzle and must be installed via NPM: `npm install kuzzle-plugin-auth-passport-oauth`

Then you need to instantiate it and use it within your application:
```js
import PluginOAuth from 'kuzzle-plugin-auth-passport-oauth';
import { Backend } from 'kuzzle';

const app = new Backend('tirana');

app.plugin.use(new PluginOAuth());
```

This strategy allows to create users in Kuzzle if they don't already exist when they login for the first time.

### `oauth` Strategy Configuration

Once installed, the OAuth plugin can be configured under the `plugins.kuzzle-plugin-auth-passport-oauth` configuration key.

Here is an example of a configuration:

```js
{
  // List of the providers you want to use with passport
  "strategies": {
    "facebook": {
      // Strategy name for passport (eg. google-oauth20 while the name of the provider is google)
      "passportStrategy": "facebook",
      // Credentials provided by the provider  
      "credentials": {
        "clientID": "<your-client-id>",
        "clientSecret": "<your-client-secret>",
        "callbackURL": "http://localhost:8080/_login/facebook",
        "profileFields": ["id", "name", "picture", "email", "gender"]
      },
      // Attributes you want to persist in the user credentials object if the user doesn't exist
      "persist": [
        "picture.data.url",
        "last_name",
        "first_name",
        "email"
      ],
      // List of fields in the OAUTH 2.0 scope of access
      "scope": [
        "email",
        "public_profile"
      ],
      //Mapping of attributes to persist in the user persisted in Kuzzle
      "kuzzleAttributesMapping": {
        // will store the attribute "email" from oauth provider as "userEmail" into the user credentials object
        "userMail": "email" 
      },
      // Attribute from the profile of the provider to use as unique identifier if you want to persist the user in Kuzzle
      "identifierAttribute": "email"
    }
  },
  // Profiles of the new persisted user
  "defaultProfiles": [
    "default"
  ]
}
```

**identifierAttribute**

This attribute will be used to identify your users. It has to be unique.  

You need to choose an attribute declared in the `persist` array.

**Attributes Persistence**

Attributes declared in the `persist` array will be persisted in the credentials object and not in the user content.  

For example, if you have the following configuration:
```js
{
  "strategies": {
    "facebook": {
      "persist": ["email", "first_name", "picture.data.url"],
      "kuzzleAttributesMapping": {
        "picture.data.url": "avatar_url"
      }
    }
  }
}
```

And your OAuth provider will send you the following `_json` payload:
```js
{
  "email": "gfreeman@black-mesa.xen",
  "first_name": "gordon",
  "last_name": "freeman",
  "picture": {
    "data": {
      "url": "http://..."
    }
  }
}
```

The created user content will be:
```js
{
  "content": {
    "profileIds": ["default"]
  },
  "credentials": {
    "facebook": {
      "email": "gfreeman@black-mesa.xen",
      "first_name": "gordon",
      "avatar_url": "http://..."
    }
  }
}
```
