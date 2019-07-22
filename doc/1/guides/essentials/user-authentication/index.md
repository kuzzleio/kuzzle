---
code: false
type: page
title: Users & Authentication
order: 750
---

# Users & Authentication

## Creating Users

Once we have created security [roles and profiles](/core/1/guides/essentials/security/), we can go on to create the users that will access the Kuzzle.

Users can be created by either using the [Kuzzle Admin Console](/core/1/guides/essentials/admin-console/) or the [API](/core/1/api/controllers/security/create-user/).

When creating a user, you will need to assign them one or more [profiles](/core/1/guides/essentials/security/#defining-profiles).

Additionally, you can set:

- [User credentials](/core/1/guides/essentials/user-authentication/#user-credentials): If no credentials are provided, then the user cannot [login](/core/1/api/controllers/auth/login/)
- Any number of properties that you want to store in your user object, such as a lastname or a list of hobbies. These properties are stored at the user level and are not linked to any particular authentication strategy.

Let's create a user with username `johndoe` and password `letmein` using the HTTP API:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "content": { "profileIds": ["default"], "fullname": "John Doe" },
  "credentials": { "local": { "username": "johndoe", "password": "letmein" } }
}' http://localhost:7512/users/_create
```

You should get the following response:

```js
{
  "requestId": "<random unique request id>",
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "createUser",
  "collection": null,
  "index": null,
  "volatile": null,
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["default"],
      "name": "John Doe"
    },
    "_meta": {
      "author": "-1",
      "createdAt": 1516186256993,
      "updatedAt": null,
      "updater": null
    }
  }
}
```

## Kuzzle User Identifier (kuid)

When a user is created, Kuzzle will automatically generate a random unique identifier for that user. This id is referred to as a `kuid` and is used by the security layer to identify a unique user and link them to multiple external identifiers (email, phone number, etc.) for use with different authentication plugins.

This system allows a user to login to Kuzzle using different strategies and, potentially, different login identifiers, while still being considered as an unique entity by Kuzzle.

If you're interested for a more in-depth explanation on how all of this work, then please check our [Kuzzle In-Depth Documentation](/core/1/guides/essentials/user-authentication/#kuzzle-user-identifier-kuid).

---

## Authentication Strategies

Once a user has been created, they can access resources in Kuzzle as permitted by their security profile. However; in order to access these resources they will first need to identify & authenticate themselves using an authentication strategy. The authentication strategy defines what credentials are used and how Kuzzle should validate them. Kuzzle supports multiple authentication strategies, giving you more flexibility when building your security layer: use [OAuth](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-oauth), Kerberos, Salesforce, and many more. And, if none of these suit your needs, follow our [Plugin Documentation](/core/1/plugins/guides/strategies) to learn how to build a custom authentication strategy.

To request access to Kuzzle, a user must first send an [authentication request](/core/1/api/controllers/auth/login/). Kuzzle will validate the credentials it receives in the request using the predefined authentication strategy and return a [JSON Web Token](https://tools.ietf.org/html/rfc7519) if the user credentials are valid.

The JSON Web Token must then be [appended to all subsequent requests](/core/1/api/essentials/query-syntax/) to access Kuzzle resources.

## Local Strategy

The simplest way a user can login to Kuzzle is using the `local` strategy. This strategy requires that a user identify themselves using a unique username and a password.

To demonstrate the `local` strategy let's use the Kuzzle Node.js SDK (the process is similar for our other SDKs).

First let's install the Node.js SDK into our folder:

```bash
npm install kuzzle-sdk
```

Then, let's create a `login.js` file that contains the following code:

<<< ./snippets/login.js

This code will:

- load the Kuzzle Node.js SDK
- connect to the Kuzzle
- login using username `johndoe` and password `letmein`

Let's try it out! Run the `index.js` using Node.js:

```
node index.js
```

You should see the following output:

```
You are now logged in!
```

---

## User Credentials

In Kuzzle, a user's credentials are composed of a list of authentication strategies and their respective profile data.

For instance, if a user registered on Kuzzle with both facebook and twitter authentication strategies, then their credentials would look like this:

```js
{
  "facebook": {
    "kuid": "<Kuzzle Unique User Identifier>",
    "login": "<login name>",
    "email": "johndoe@foobar.qux"
  },
  "twitter": {
    "kuid": "<Kuzzle Unique User Identifier>",
    "login": "<login name>",
    "avatar_url": "http://..."
  }
}
```

Notice that the `kuid` is present in both the facebook property and the twitter property.

---
