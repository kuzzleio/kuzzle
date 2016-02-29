# Kuzzle Authentication scenarios

This page explains what happens when a client authenticates to Kuzzle, with 2 examples:
* A simple authentication with the "Local" strategy
* A 2-step authentication with the "Github" strategy, which authenticate github usesr with **oauth2** protocol.

## Overview

Kuzzle uses [passportjs](http://passportjs.org/) to enable authentication with a potentially large amount of providers.

(NB: Technical details about how to enable your own passport strategy within a plugin are described [here](../security/authentication.md). )


Remember the [Architecture overview](../architecture.md) and focus on the components involved by authentication:
![auth_scenario_overview](../images/kuzzle_auth_scenario_overview.png)

Kuzzle uses these internal components during the authentication process:
* The Auth Controller
* The "Passport Wrapper", who makes an interface between Kuzzle controllers and the Passport library
* The User and Token [Repositories](../../lib/api/core/models/repositories/README.md), to retrieve users' data.
* The Authentication strategy, implemented within a dedicated plugin.

## Sample scenario with the Local Plugin

The "Local" strategy authenticates a user locally with its username/password, implemented by the [Passport Local Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local).

Detailed workflow:

![auth_scenario_details_local](../images/kuzzle_auth_scenario_details_local.png)

\#1. The user calls the *login* action of the ```Auth Controller```:

```json
{
  "controller": "auth",
  "action": "login",
  "body": {
    "strategy": "local",
    "username": "<my_username>",
    "password": "<my_password>"
  }
}
```

\#2. The ```Auth Controller``` calls the *authenticate()* method of the ```Passport Wrapper``` which format and sends the related request to the ```Passport local strategy```.

\#3. The ```Passport local strategy``` calls the *verify()* callback method declared by the ```Local Authentication Plugin``` to check credentials.

\#4. The plugin calls the ```User Repository``` and check if credentials are good and resolve to an existing user.

\#5. If a user is found, he is resolved and sends back to the ```Auth Controller``` through the internal components.

\#6. The ```Auth Controller``` calls the *generateToken()* method to get a [JWT Token](https://jwt.io/) related to the user.

\#7. The JWT Token is sent back to the client, who will use it in next requests to be authenticated:

Sample response:

```json
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "login",
  "state": "done",
  "requestId": "ed4faaff-253a-464f-a6b3-387af9d8483d",
  "metadata": {},
  "result": {
    "_id": "my_username",
    "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJteV91c2VybmFtZSIsIm5hbWUiOiJKb2huIERvZSIsImFkbWluIjp0cnVlfQ.BefoyfAKzwXuGhbYe0iPeG0v9F4HmikvahqwqzQr3pE"
  }
}
```

## OAuth2 scenario with the Github Plugin

The "Github" strategy authenticates a user locally with its github account, implemented by the [Passport Github Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-github), using OAUth2 protocol with "Authorization Code" grant type.

For more details about OAuth2 protocol, see [here](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2#grant-type-authorization-code).

Detailed workflow:

![auth_scenario_details_oauth2](../images/kuzzle_auth_scenario_details_oauth2.png)

The authentication flow is a 2-step flow:

### 1st step: get the OAuth2 Provider's URL

\#1. The user calls the *login* action of the ```Auth Controller```:

```json
{
  "controller": "auth",
  "action": "login",
  "body": {
    "strategy": "github"
  }
}
```

\#2. The ```Auth Controller``` calls the *authenticate()* method of the ```Passport Wrapper``` which format and sends the related request to the ```Passport github strategy```.

\#3. While no Authorization code is provided, the strategy calls a redirection to the ```OAuth2 Provider```

\#4. The ```Passport Wrapper``` intercepts the redirection request and format a Kuzzle Response for the client:

```json
{
  "headers":
  {
    "Content-Length": "0",
    "Location": "https://github.com/login/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Fkuzzle%2Fapi%2F1.0%2F_login%2Fgithub&client_id=MY_CLIENT_ID"
  },
  "statusCode": 302
}
```

\#5. The ```Auth Controller``` sends the response to the client, with the redirection URL to the ```OAUth2 Provider```:

```json
{
  "action": "login",
  "controller": "auth",
  "error": null,
  "metadata": {},
  "requestId": "fd4246f9-717c-4503-b50b-3a5bf0f142b5",
  "result": {
    "headers": {
      "Content-Length": "0",
      "Location": "https://github.com/login/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Fkuzzle%2Fapi%2F1.0%2F_login%2Fgithub&client_id=MY_CLIENT_ID"
    },
    "statusCode": 302
  },
  "scope": null,
  "state": "done",
  "status": 200
}
```


### 2nd step: authenticate the user with the OAuth2 code.

\#6. The Client sends an HTTP request to the ```OAuth2 Provider``` (has to be implemented within the client's application code).

\#7. The user authenticates himself to the ```Oauth2 Provider``` and allow Kuzzle Application to use his credentials (standard OAuth2 flow, managed at the provider's side).

\#8. The ```OAuth2 Provider``` sends a HTTP redirect response to the client, containing the oauth2 authorization code:

```
HTTP/1.1 302 Found
Location: http://<kuzzle>/api/1.0/_login/github?code=OAUTH2_CODE
```

\#9. The client calls again the *login* action of the ```Auth Controller```, including this time the oauth2 authorization code:

* either in REST, simply following the HTTP Redirection:

```
curl http://<kuzzle>/api/1.0/_login/github?code=OAUTH2_CODE
```

* or, with another protocol (for example WebSocket), after having parsed the URL to get the authorization code:

```json
{
  "controller": "auth",
  "action": "login",
  "body": {
    "strategy": "github",
    "code": "OAUTH2_CODE"
  }
}
```

\#10. The ```Auth Controller``` calls the *authenticate()* method of the ```Passport Wrapper``` which format and sends the related request to the ```Passport github strategy```.

\#11. The ```Passport github strategy``` transmits the oauth2 authorization code to the ```OAuth2 Provider``` in order to retrieve the OAuth2 Token.

\#12. The ```Passport github strategy``` calls the *verify()* callback method declared by the ```Github Authentication Plugin```

\#13. The plugin calls the ```User Repository``` to check for an existing user with the given github ID.

(Note: If no related user is found in kuzzle, the plugin can either deny the authentication, or create automatically the user, depending to its settings).

\#14. The user is resolved and sends back to the ```Auth Controller``` through the internal components.

\#15. The ```Auth Controller``` calls the *generateToken()* method to get a [JWT Token](https://jwt.io/) related to the user.

\#16. The JWT Token is sent back to the client, who will use it in next requests to be authenticated:


## Related pages

* [Architecture overview](../architecture.md)
* [Authentication details](../security/authentication.md)
* [API Documentation](http://kuzzleio.github.io/kuzzle-api-documentation)
