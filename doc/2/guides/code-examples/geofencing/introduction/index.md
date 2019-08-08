---
code: false
type: page
title: Introduction
order: 0
description: Geofencing Code Examples
---

## Code Example: Geofencing

Kuzzle has real-time geofencing capabilities that can detect changes in incoming geospatial data and trigger notifications based on activity relative to a designated perimeter. For example, a device can track a user's location and send this data to Kuzzle, which will detect when the user is near a store and send them special offers specific to that store.

In this code example we will show you how geofencing works with Kuzzle.

## Configure Kuzzle

First let's make sure Kuzzle is running and create the index and collection we will use to store documents. Follow these [instructions](/core/1/guides/getting-started//#running-kuzzle).

## Create Your App

Now that we have our Kuzzle configured, we can start programming our App. Here is an outline of what the App will do:

1. _Connect to Kuzzle_
2. _Subscribe to a geographical boundary_ that Kuzzle will monitor
3. _Place a user inside the geographical boundary_ by creating a location document
4. _Place the user outside the geographical boundary_ by updating the location document

Before we get started on the App, there are a few basics you need to know:

- Firstly, Kuzzle subscription mechanism works by monitoring changes in documents sent through the API. A subscriber will tell Kuzzle what changes to look out for and will receive a message whenever Kuzzle detects such a change in a request. So an App that wants to receive a message from Kuzzle whenever _a user leaves a geographical boundary_ will receive that message as a result of Kuzzle detecting a change in a document that represents the user's location. We can do this by sending a document to Kuzzle which contains a location field.

- Secondly, in order for Kuzzle to detect that a user leaves a geographical boundary, it must first detect that the user has entered the geographical boundary. This means that we need to create a document that contains a location field where the geopoint is inside the boundary prior to updating that document and setting the location field to a geopoint outside the boundary.

- Thirdly, a subscription is done at the collection level. This means that Kuzzle will only monitor changes to documents in the specified collection.
