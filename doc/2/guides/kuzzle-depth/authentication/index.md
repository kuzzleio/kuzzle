---
code: false
type: page
title: Authentication
---

# Authentication

Kuzzle uses [Passport.js](http://Passportjs.org) to support numerous authentication strategies, including:

- OAuth2: for authentication using providers such as GitHub or Google (click [here](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-oauth) for more details).
- SAML: for authentication using providers such as OneLogin and for supporting single sign-on.
- Local: for authentication using a user's username and password managed in your own domain.

In the diagram below, we highlighted components of Kuzzle's server [architecture](/core/2/guides/kuzzle-depth) that are used in the authentication process:

![read_scenario_http_overview](./Authentication_Overview.png)

- The Auth Controller: to manage the authentication process.
- The Passport Wrapper: to interface between Kuzzle and the Passport.js library.
- The User and Token [Repositories](https://github.com/kuzzleio/kuzzle/tree/master/lib/core/shared/repository.js): to store user data.
- The Auth Strategy: to identify and validate a user's credential using a [dedicated plugin](/core/2/plugins/guides/strategies).

---

## The Kuzzle User Identifier

The Kuzzle User Identifier (`kuid`) is a string that identifies a unique user. It is used internally to link the user to their credentials for each strategy they use to authenticate.

The `kuid` is assigned when the user is first created and can be provided in the input data of the user _create_ method or otherwise generated automatically by Kuzzle.

---

### Local Authentication Strategy

The Local Authentication Strategy, implemented in the [Passport Local Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local), authenticates a user by their username and password, which are stored in a local repository. The following diagram shows how the authentication request flows between the Client Application and Kuzzle's server components:

![auth_scenario_details_local](./details-local.png)

- The Client Application calls the `login` action of the _Auth Controller_:

```js
{
  "controller": "auth",
  "action": "login",
  "strategy": "local",
  "body": {
    "username": "<my_username>",
    "password": "<my_password>"
  }
}
```

- The _Auth Controller_ calls the `authenticate()` method of the _Passport Wrapper_.

- The _Passport Wrapper_ calls the `verify()` method in the _Local Authentication Plugin_.

- The _Local Authentication Plugin_ validates the credentials against the [local storage](/core/2/plugins/plugin-context/constructors/repository) and returns the user's `kuid` if the credentials are valid.

- The _Passport Wrapper_ calls the _User Repository_ to get the profile data for the user with the given `kuid`.

- The user profile data is returned back to the _Auth Controller_.

- The _Auth Controller_ calls the `generateToken()` method to get a [JWT Token](https://jwt.io) for the user.

- The JWT Token is then sent back to the Client Application and should be used in subsequent requests to Kuzzle's API. Below is an example response after the authentication process is complete:

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "login",
  "state": "done",
  "requestId": "ed4faaff-253a-464f-a6b3-387af9d8483d",
  "volatile": {},
  "result": {
    "_id": "user-kuid",
    "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJteV91c2VybmFtZSIsIm5hbWUiOiJKb2huIERvZSIsImFkbWluIjp0cnVlfQ.BefoyfAKzwXuGhbYe0iPeG0v9F4HmikvahqwqzQr3pE",
    "expiresAt": 1321085955000,
    "ttl": 360000
  }
}
```

---

### OAuth2 Authentication Strategy

The Oauth2 Authentication Strategy, implemented in the [Passport Oauth Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-oauth), authenticates a user via Github, Google+, Facebook, Twitter, or any other identity provider that uses the OAuth2 protocol with the "Authorization Code" grant type.

For more details about OAuth2 protocol, click [here](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2#grant-type-authorization-code).

The following diagram outlines how an Oauth2 authentication request flows between the Client Application, the Authentication Provider (in this case GitHub), and Kuzzle's server components:

![auth_scenario_details_oauth2](./details-oauth2.png)

The authentication flow has two steps: first we request the Authentication Provider's URL used to authenticate the user on the third-party platform, then we perform the authentication.

#### Step One: Request Authentication Provider URL

- The user calls the `login` action of the _Auth Controller_:

```js
{
  "controller": "auth",
  "action": "login",
  "strategy": "github"
}
```

- The _Auth Controller_ calls the `authenticate()` method of the Passport Wrapper which formats and sends the request to the _Authentication Strategy_ (in this case the Passport Oauth Plugin).

- The _Passport Oauth Plugin_ returns an HTTP redirect to the _OAuth2 Provider_.

- The _Passport Wrapper_ intercepts the HTTP redirect response and formats the response for the client:

```js
{
  "headers":
  {
    "Content-Length": "0",
    "Location": "https://github.com/login/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Fkuzzle%2Fapi%2F1.0%2F_login%2Fgithub&client_id=MY_CLIENT_ID"
  },
  "statusCode": 302
}
```

- The _Auth Controller_ sends the response, which includes the Authentication Provider's URL, to the client:

```js
{
  "status": 302
  "error": null,
  "controller": "auth",
  "action": "login",
  "state": "done",
  "requestId": "fd4246f9-717c-4503-b50b-3a5bf0f142b5",
  "volatile": {},
  "result": {
    "headers": {
      "Content-Length": "0",
      "Location": "https://github.com/login/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Fkuzzle%2Fapi%2F1.0%2F_login%2Fgithub&client_id=MY_CLIENT_ID"
    },
    "statusCode": 302
  }
}
```

#### Step Two: Authenticate the User

- The Client Application sends an HTTP request to the _OAuth2 Provider_ (use our [SDK](https://github.com/kuzzleio/kuzzle-sdk-login-oauth-popup) to add this functionality to your Client Application).

- The user then authenticates with the _OAuth2 Provider_ and gives Kuzzle permission to use their third-party credentials.

- The _OAuth2 Provider_ sends an HTTP redirect response to the Client Application which contains the OAuth2 Authorization Code:

```
HTTP/1.1 302 Found
Location: http://< kuzzle >/_login/github?code=OAUTH2_CODE
```

<br/>
* The Client Application then calls the `login` action of the *Auth Controller* and includes the OAuth2 Authorization Code:
  * If the request is made over HTTP the Authorization Code is sent as a query parameter in the request URL: `curl http://< kuzzle >/_login/github?code=OAUTH2_CODE`
  * If the request is made over Websocket the Authorization Code is sent as a parameter in the body of the message:

```js
{
  "controller": "auth",
  "action": "login",
  "strategy": "github",
  "body": {
    "code": "OAUTH2_CODE"
  }
}
```

- The _Auth Controller_ then calls the `authenticate()` method of the _Passport Wrapper_ which formats and sends the request to the _Authentication Strategy_ (in this case the _Passport Oauth Plugin_).

- The _Passport Oauth Plugin_ forwards the _OAuth2 Authorization Code_ to the _OAuth2 Provider_ (GitHub) in order to retrieve the OAuth2 Token and the user's third-party profile data.

- The _Passport Oauth Plugin_ then checks internal storage to see if a user already exists with the given _OAuth2 Provider_ ID (GitHub ID), and returns their `kuid` to the _Passport Wrapper_ _(Note: If no user is found in Kuzzle, the plugin can either deny the authentication request or create the user automatically depending on the settings)._

- The _Passport Wrapper_ calls the _User Repository_ to get the profile data for the user with the given `kuid`.

- The user profile data is returned back to the _Auth Controller_.

- The _Auth Controller_ calls the `generateToken()` method to get a [JWT Token](https://jwt.io) for the user.

- The JWT Token is then sent back to the Client Application and should be used in subsequent requests to Kuzzle's API.

---

## Additional Authentication Strategies

Kuzzle can implement any strategy supported by Passport.js. For more information, please refer to the [Plugins Reference](/core/2/plugins/guides/strategies).

---
