---
code: false
type: page
title: First Steps
description: learn kuzzle in a few steps
order: 200
---

# First Steps with Kuzzle

It's time to play with the [Kuzzle JS SDK](/sdk). In this section, we will learn how to store a document and subscribe to notifications in Kuzzle using the Javascript SDK in a simple NodeJS client application.

Before proceeding, please make sure your system has these programs installed:

- **Node.js** version 6 or higher ([download page](https://nodejs.org/en/download))
- Kuzzle

:::info
Having trouble? Get in touch with us on [Gitter](https://gitter.im/kuzzleio/kuzzle)!
:::

## Prepare your environment

Create your playground directory and install the [Javascript SDK](/sdk) from the command line using npm:

```bash
mkdir kuzzle-playground
cd kuzzle-playground
npm install kuzzle-sdk
```

:::info
If you are performing a clean install you might see some `UNMET PEER DEPENDENCY` warnings, these are safe to ignore as they refer to optional dependencies.
:::

Then, create an `init.js` file and start by loading the Kuzzle Javascript SDK.
Next, instantiate a client that automatically connects to Kuzzle via WebSocket. Replace `'kuzzle'` with the corresponding server name or IP address:

<<< ./snippets/load-sdk.js

Finally, we will add the code that will access Kuzzle to create a new index 'playground' and a new collection 'mycollection' that we will use to store data later on.

<<< ./snippets/init-sample.js{3,5,6,7,8}

Your `first-step.js` file should now look like this:

<<< ./snippets/init.js

This code does the following:

- loads the `Kuzzle SDK` from its NPM package
- creates an instance of the SDK and connects it to Kuzzle running on `localhost` (and selects the `playground` as default index),
- creates the `playground` index,
- creates the `mycollection` collection (within the `playground` index),
- disconnects from Kuzzle after the collection is created or if an error occurs.

Run your file in Node.js

```bash
node first-step.js
```

Your console should output the following message:

```bash
playground/mycollection ready
```

:::success
Congratulations! You are now ready to say Hello to the World!
:::

## Create your first "Hello World" document

Create a `create.js` file with the following code:

<<< ./snippets/create.js

This code does the following:

- creates a new document containing the message "Hello, World" in `mycollection` within the `playground` index,
- logs a success message to the console if everything went fine,
- logs an error message if any of the previous actions failed,
- disconnects from Kuzzle after the document is created or if an error occurs.

Run your file in Node.js

```bash
node create.js
```

Your console should show the following message:

```bash
document created
```

:::success
You have now successfully stored your first document into Kuzzle. Check the [Admin Console Guide](/core/2/guides/essentials/admin-console) to see how to browse your collection and confirm that your document was saved.
:::

_You can find more resources about Kuzzle SDK in the [SDK Reference](/sdk)._

## Subscribe to data changes (pub/sub)

Kuzzle provides pub/sub features that can be used to trigger real-time notifications based on the state of your data (for a deep-dive on notifications check out the **Room** class definition in the [/sdk](SDK Reference)).

Let's get started. Complete your `create.js` file:

<<< ./snippets/subscribe.js

Run your file in Node.js

```bash
node create.js
```

This creates a new document in Kuzzle, triggering a [notification](/core/2/guides/essentials/real-time):

```bash
subscribe ok
document created
message received from kuzzle: Hello, World!
```

:::success
Congratulations! You have just choreographed your first pub/sub pattern!
:::

## Where do we go from here?

Now that you're more familiar with Kuzzle, dive even deeper to learn how to leverage its full capabilities:

- take a look at the [/sdk](SDK Reference)
- learn how to use [/core/2/guides/cookbooks/realtime-api](Koncorde) to create incredibly fine-grained and blazing-fast subscriptions
- follow our guide to learn how to implement [/core/2/guides/essentials/user-authentication#local-strategy](basic authentication)
- follow our guide to learn how to implement [/core/2/guides/essentials/security/](manage users and setup fine-grained access control)
