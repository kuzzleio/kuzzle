---
code: false
type: page
title: General Purpose Backend
description: Kuzzle main concepts and features overview
order: 200
---

# General Purpose Backend

Kuzzle is a generic backend offering **the basic building blocks common to every application**.

Rather than developing the same standard features over and over again each time you create a new application, Kuzzle proposes them off the shelf, allowing you to focus on building **high-level, high-value business functionalities**.

## API First

The majority of Kuzzle's features are available via its [API](/core/2/guides/main-concepts/1-api) for various external clients.

This **multi-protocol API** allows clients to communicate with Kuzzle and use the backend features through the **protocol that best suits their needs**.

Whether it is the creation and modification of the database or the management of users and rights, **everything is available through the different controllers of the API**.

The API provides a **standard communication format** for requests and responses so that every client has the same experience.

Access to each action is thus **centralized within the rights management system** for a better understanding and maintenance.

## Ready-to-use Database

Kuzzle uses Elasticsearch as a [NoSQL document store](/core/2/guides/main-concepts/2-data-storage).

With Kuzzle, customers **can directly access data stored in the database** as long as they have the rights to do so.

It's **no longer needed to create a new controller every time new data need to be displayed**, and it's no longer needed to add parameters to controller actions to refine searches either: **queries are expressed directly on the client's side**.

Kuzzle exposes the [Elasticsearch Query Language](/core/2/guides/main-concepts/3-querying) in a secure way. It is therefore possible to **take full advantage of the possibilities of Elasticsearch** with boolean queries, aggregations, special fields, etc.

```js
// Retrieve documents matching the Elasticsearch query
let result = await sdk.document.search('iot', 'sensors', {
  query: {
    bool: {
      filter: [
        { term: { model: 'temperature' } },
        { range: { value: { gt: 42 } } },
      ]
    }
  }
})
```

In the same way, creating collections or the writing of documents is also done directly from the frontend into the database collections:

```js
// First create an index and a collection to handle our data
await sdk.index.create('iot')
await sdk.collection.create('iot', 'sensors', {
  mappings: {
    model: { type: 'keyword' },
    temperature: { type: 'integer' },
  }
})

// Create a document inside our collection
let result = await sdk.document.create('iot', 'sensors', {
  model: 'temperature',
  temperature: 42
})
```

## Authentication

Kuzzle features a [multi-authentication system](/core/2/guides/main-concepts/5-authentication) for users.

Rather than using a single authentication system, Kuzzle embeds [Passport.js](http://www.passportjs.org/) and **makes available the use of its 500+ authentication strategies** by writing an authentication plugin.

So your users can choose to authenticate themselves with a classic **login / password** but also from an **OAuth** provider such as Facebook or Google, an **LDAP directory**, via **SAML**, etc.

Kuzzle fits perfectly in a **context of SSO and centralization of authentication** within an information system.

## Right Management

[Rights Management](/core/2/guides/main-concepts/4-permissions) is already integrated in the backend functionalities. The **rights can be configured through the Kuzzle API** or through our Admin Console.

Kuzzle has a **standard system with 3 dimensions**. Roles control access to API actions, profiles are a composition of roles and finally users are a composition of profiles.

[Users, Profiles and Roles](./profiles-roles.png)

This system allows to manage the majority of access control rights situations. For the most advanced cases, Kuzzle **allows to dynamically restrict access rights** via its event system and its pipe mechanism.

```ts
// Restrict document reading to their creator only
app.pipe.register('generic:document:afterGet', async (documents: Document[], request: Request) => {
  for (const document of documents) {
    if (request.context.user._id !== document._source._kuzzle_info.creator) {
      throw new ForbiddenError(`Not allowed to access document ${document._id}`)
    }
  }

  return documents
})
```

## Extensibility

Like any framework, Kuzzle allows you to **develop new features by extending and modifying the existing API**.

To do so, just install the [NPM kuzzle package](https://www.npmjs.com/package/kuzzle) and start developing your application.

```js
import { Backend, Request } from 'kuzzle'

const app = new Backend('iot-tracker')

// Register a new API controller
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: (request: Request) => `Hello, ${request.input.args.name}`
    }
  }
})

app.start()
  .then(() => app.log.info('Application started'))
```

Kuzzle offers different mechanisms to **develop the business functionalities** of your application:
 - [API Controller](/core/2/guides/develop-on-kuzzle/2-api-controllers)
 - [Event System](/core/2/guides/develop-on-kuzzle/3-event-system)
 - [External Plugin](/core/2/guides/develop-on-kuzzle/4-external-plugins)

Everything you will build upon your application will **benefit from the advantages of Kuzzle API** such as multi-authentication, rights management, standard request and response format, cluster scalability, anti-DoS protection, etc.

## Embrace Typescript

Kuzzle exposes [interfaces written in Typescript](/core/2/framework/classes) for a **faster learning curve** and a **better application maintainability**.

This support is available for writing backend applications as well as frontend applications.

Whether in the backend or in the frontend, **developers use the same interface to interact with Kuzzle**: [Kuzzle Javascript SDK](/sdk/js/7/)

The Javascript SDK is of course used by frontend applications but also in the backend, so developers can capitalize on their experience to **allow isomorphic backend / frontend development**.

## Realtime Notifications

Kuzzle has its own [high-performance realtime engine](/core/2/guides/main-concepts/6-realtime-engine-engine).  

This engine allows you to use pub/sub communications in a conventional way, but it's also capable of triggering [realtime database notification](/core/2/guides/main-concepts/6-realtime-engine-engine#database-notifications).  

Every **change occuring on the database can generate realtime notifications**. Clients can listen to database changes and **synchronize frontends or other backend applications** accordingly.

The realtime engine also offers the possibility to subscribe with **filters in order to receive only the desired notifications**.

```ts
// Receive database notification only if a document "temperature" field 
// is greather than 42
await sdk.realtime.subscribe('iot', 'sensors', {
  range: {
    temperature: { gt: 42 }
  }
},
async (notification: Notification) => {
  console.log(`Sensor ${notification.result._id} temperature is too high!`)
})
```

The entire realtime engine is used exclusively from a client (frontend or backend) and **does not require any additional code on the Kuzzle application side** to generate and transmit notifications.

## Integrated Cluster Mode

Kuzzle is a backend designed to **scroll horizontally to millions of users**.  

With its integrated [masterless cluster mode](/core/2/guides/advanced/5-cluster-scalability), it allows hot-starting new application instances to handle the load.

In addition to allowing scalability, the cluster mode **offers high availability to reach 99.99% uptime** for your application.

So it is possible to start your application by deploying it on a single server and then deploy the same code on several servers on the day when there is a need to handle a higher load.

## Get Started !

Follow our Getting Started to develop your first server application: [Kuzzle application journey](/core/2/guides/getting-started/1-run-kuzzle)

Or start to develop a client application by using one of our [SDKs](/sdk):

### Backend
 - [Node.js](/sdk/js/7/getting-started/node-js)
 - [Java SDK](/sdk/jvm/1/getting-started/java)
 - [Kotlin](/sdk/jvm/1/getting-started/kotlin)
 - [C# .NET Core](/sdk/csharp/2/getting-started/standalone/)
 
### Frontend Web
 - [React.js](/sdk/js/7/getting-started/react/standalone/)
 - [Vue.js](/sdk/js/7/getting-started/vuejs/standalone/)
 - [Webpack](/sdk/js/7/getting-started/webpack/)
 - [Vanilla JS](/sdk/js/7/getting-started/raw-web/)

### Frontend Mobile

 - [React Native](/sdk/js/7/getting-started/react-native/)
 - [Flutter](/sdk/dart/2/getting-started/flutter/)
 - [Kotlin](/sdk/jvm/1/getting-started/kotlin)
 - [Java SDK](/sdk/jvm/1/getting-started/java)
 - [C# .NET Core](/sdk/csharp/2/getting-started/standalone/)
