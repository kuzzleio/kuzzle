---
code: false
type: page
title: General Purpose Backend
description: Kuzzle main concepts and features overview
order: 200
---

# General Purpose Backend

Kuzzle is a generic backend offering features common to all applications.

Rather than redeveloping functionalities that don't bring any added value, Kuzzle proposes to use them as is to build its high-level business functionalities.

## Extensibility

Like any framework, Kuzzle allows you to develop new features by extending and modifying the existing API.

To do so, just install the NPM kuzzle package and start developing your application.

```js
import { Backend, Request } from 'kuzzle'

const app = new Backend('iot-tracker')

// Register a new API controller
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: (request: request) => `Hello, ${request.input.args.name}`
    }
  }
})

app.start()
  .then(() => app.log.info('Application started'))
```

Kuzzle offers different mechanisms to develop the business functionalities of its application:
 - API Controller
 - Event System
 - External Plugin

All the developed functionalities will benefit from the advantages of the Kuzzle API such as multi-authentication, rights management, standard request and response format, cluster scalability, anti-dos protection, etc.

## API First

The majority of Kuzzle's functionalities are available via its API for various external clients.

This multi-protocol API allows clients to communicate with Kuzzle and use the backend features through the protocol that best suits their needs.

Whether it is the creation and modification of the database or the management of users and rights, everything is available through the different controllers of the API.

The API provides a standard communication format for requests and responses so that every client has the same experience.

Access to each action is thus centralized within the rights system for a better understanding and maintenance.

## Unleash the Frontend

With Kuzzle, customers can directly access all the data stored in the database as long as their have the rights to do so.

No more need to create a new controller every time new data needs to be displayed, no more need to add parameters to controller actions to refine searches: everything is done directly on the client side.

Kuzzle exposes the Elasticsearch query language in a secure way. It is therefore possible to take full advantage of the possibilities of Elasticsearch with boolean queries, aggregations, special fields, etc.

```js
let result = await sdk.document.search('iot', 'sensors', {
  query: {
    bool: {
      filter: [
        { term: { type: 'temperature' } },
        { range: { value: { gt: 42 } } },
      ]
    }
  }
})
```

In the same way, the writing of documents is also done directly from the frontend into the database collections:

```js
let result = await sdk.document.create('iot', 'sensors', {
  type: 'temperature',
  temperature: 42
})
```

## Embrace Typescript

Kuzzle exposes interfaces written in Typescript for a faster learning curve and a better maintainability of the applications.

This support is available for writing backend applications as well as frontend applications.

Whether in the backend or in the frontend, developers use the same interface to interact with Kuzzle: Kuzzle Javascript SDK.

The Javascript SDK is of course used by frontend applications but also in the backend, so developers can capitalize on their experience to allow isomorphic backend / frontend development.

## Authentication and Right Management

Multi auth

## Realtime Notifications
Realtime Engine

## Integrated Cluster Mode
Cluster
 