---
code: false
type: page
title: Introduction
description: learn mechanisms of kuzzle
order: 0
---

# Introduction

Kuzzle is a ready-to-use, **open-source**, **on-premises** suite that allows you to build modern web, mobile and IoT applications in no time. Thanks to its built-in features you can easily:

- **connect your apps** using our available SDKs and multiple protocols.
- **manage your data** using the built-in pesistence engine.
- **trigger real-time notifications** using our real-time engine.
- **manage authentication** using OAuth2 and many other authentication strategies.
- **customize your backend** using the plugins engine and your own code.

## Connect your apps

Kuzzle ships with a set of open-source [SDKs](/sdk) for a variety of programming languages:

- [Javascript](https://github.com/kuzzleio/sdk-javascript) (Node.js & Browsers)
- [Android](https://github.com/kuzzleio/sdk-android)
- [PHP](https://github.com/kuzzleio/sdk-php)
- [and more](/sdk)...

Additionally, Kuzzle supports a variety of communication protocols:

- HTTP
- Websocket
- Socket.io
- MQTT

You can interact directly with Kuzzle through its API, read the [Kuzzle API reference](/core/2/api) for more information.

## Manage your data

Kuzzle relies on [Elasticsearch](https://www.elastic.co) to store, fetch and peform a variety of CRUD and fine-grained search operations on persistent data. Please refer to our [working with persistent data](/core/2/guides/essentials/store-access-data) section for more details.

## Trigger real-time notifications

Kuzzle lets you to setup subscriptions on specific datasets in order to trigger real-time notifications based on different data events.
To define what events will trigger a notification we use **filters**, which describe what data to observe using a domain-specific language (DSL) that we tailored for this purpose.

Please click [here](/core/2/guides/essentials/real-time) for more details.

## Manage Authentication

Kuzzle supports a variety of authentication strategies via [Passport.js](http://passportjs.org). Local and OAuth-based authentication is natively supported, but you can also add your own custom strategy.

Please click [here](/core/2/guides/essentials/security) for more details.

## Customize your backend

Kuzzle can be tailored to your specific requirements thanks to the Plugin Engine, which lets you:

- trigger actions on data-related events
- intercept the data flow at any point of its lifecycle
- add custom methods to the public API
- add new communication protocols
- add new authentication strategies

Please click [here](/core/2/guides/essentials/plugins) for more details.
