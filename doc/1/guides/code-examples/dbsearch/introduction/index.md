---
code: false
type: page
title: Introduction
order: 0
description: Database Code Examples
---

## Code Example: Database Search

Kuzzle uses Elasticsearch as its datastore and provides a user friendly interface so that you can quickly create documents and take advantage of Elasticsearch's fast search capabilities.

## Configure Kuzzle

First let's make sure Kuzzle is running and create the index and collection we will use to store documents. Follow these [instructions](/core/1/guides/getting-started#running-kuzzle).

## Create Your App

Now that we have our Kuzzle configured, we can start programming our App. Here is an outline of what the App will do:

1. _Connect to Kuzzle_
2. _Create a document_ that will be stored in Kuzzle
3. _Search for the Document_
