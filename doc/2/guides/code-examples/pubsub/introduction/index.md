---
code: false
type: page
title: Introduction
order: 0
description: Pub/Sub Code Examples
---

## Code Example: Real-Time Pub/Sub

Kuzzle comes equipped with real-time pub/sub capabilities that can be used to send targeted notifications to client applications.

In this code example we will show you how pub/sub works with Kuzzle.

## Configure Kuzzle

First let's make sure Kuzzle is running and create the index and collection we will use to store documents. Follow these [instructions](/core/2/guides/getting-started#running-kuzzle).

## Create Your App

Now that we have our Kuzzle configured, we can start programming our App. Here is an outline of what the App will do:

1. _Connect to Kuzzle_
2. _Subscribe to documents with specific criteria_ that Kuzzle will monitor
3. _Publish a document_ that will trigger the notification

Before we get started on the App, there are a few basics you need to know:

- Firstly, a subscription is done at the collection level. This means that Kuzzle will only monitor changes to documents in the specified collection.

- Secondly, unlike typical pub/sub solutions, there is no need to create a topic first. In Kuzzle, the topic is replaced by a document `filter` which is sent by the Client when it makes a subscription request. Clients can subscribe using the same document filter, effectively simulating a `topic`.
  For more information about subscriptions click [here](/core/2/api/controllers/realtime/subscribe)
