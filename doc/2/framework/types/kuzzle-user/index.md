---
code: false
type: page
title: KuzzleUser | Framework | Core

description: KuzzleUser type definition
---

# KuzzleUser

<SinceBadge version="2.57.0" />

The `KuzzleUser` type represents the user who sent a request, as Kuzzle knows it on the server side. It is the type of [request.context.user](/core/2/framework/classes/request-context/properties) and of the result of [request.getUser()](/core/2/framework/classes/kuzzle-request/get-user).

It is a type-only export: plugins and applications read it, but do not create it.

::: info
`KuzzleUser` is not the `User` class exported by `kuzzle`: that one is the Javascript SDK's client-side user, as returned by the `app.sdk.security.*` methods.
:::

## Properties

| Property     | Type                | Description                                                                                                  |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `_id`        | <pre>string</pre>   | User unique identifier (kuid). The anonymous user's is `-1`                                                  |
| `profileIds` | <pre>string[]</pre> | Identifiers of the user's security profiles                                                                  |
| `strategies` | <pre>any</pre>      | Authentication strategies the user has credentials for, when known                                           |

The custom content of the user (the properties set when creating it, such as a `name`) is copied onto the object too, next to `profileIds`. These properties are not typed.

## Methods

| Method                     | Returns                              | Description                                                                                                         |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `getProfiles()`            | <pre>Promise&lt;Profile[]&gt;</pre>  | Loads the user's security profiles                                                                                  |
| `getRights()`              | <pre>Promise&lt;object&gt;</pre>     | Resolves to the rights granted by the user's profiles, merged                                                       |
| `isActionAllowed(request)` | <pre>Promise&lt;boolean&gt;</pre>    | Tells whether the user's profiles allow the given [KuzzleRequest](/core/2/framework/classes/kuzzle-request/properties) |

**Example:**

```ts
import { KuzzleRequest, KuzzleUser } from 'kuzzle';

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        const user: KuzzleUser = request.getUser();

        return `Hello, ${user._id} (profiles: ${user.profileIds.join(', ')})`;
      }
    }
  }
});
```
