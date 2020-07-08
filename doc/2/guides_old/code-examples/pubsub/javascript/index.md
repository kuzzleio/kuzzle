---
code: false
type: page
title: Javascript
---

## Pub/Sub with Javascript

For this example we will use Node.js. You will need to install Node.js and NPM.

Let's create a new project folder called `realtimePubSub`:

```bash
    mkdir realtimePubSub
```

For this code example we need Kuzzle's Javascript SDK. To install it, run:

```bash
    npm install kuzzle-sdk
```

We can create an `index.js` file in the `realtimePubSub` folder to program our test.

```bash
    touch index.js
```

## Connect to Kuzzle

The first thing we need to do is connect to Kuzzle. To do this write the following code:

<<< ./snippets/load-sdk.js

Replace `kuzzle` with the IP address or with the name of the Kuzzle server.

## Subscribe to Documents with Specific Criteria

Let's use the _subscribe_ method.

We will perform a subscription request that tells Kuzzle that the App wants to be notified anytime a document is created that contains the _message_ field. We define this subscription filter as follows, for more information about filters click [here](/core/2/guides/cookbooks/realtime-api):

<<< ./snippets/subscribe.js

We have now programmed the subscription side of the test.

## Publish a Document

Now let's move on to the publish side of the test. Here we will publish a document that contains the `message` field. When Kuzzle receives this message, it will detect that there is a subscriber listening for such messages and will send it to these subscribers, in this case to our Android App.

We will use the _publish_ method that creates a document containing the value `hello world` in the `message` field.

<<< ./snippets/publish.js

## Run the Test

The full code should look something like this:

<<< ./snippets/pubsubjs.js

Your console should show the following message:

```bash
hello world
```
