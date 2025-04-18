---
code: false
type: page
order: 200
title: General Purpose Backend | Kuzzle Introduction | Guide | Core
meta:
  - name: description
    content: Kuzzle main concepts and features overview
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend
---

# General Purpose Backend

Kuzzle is a generic backend offering **the basic building blocks common to every application**.

Rather than developing the same standard features over and over again every time you create a new application, Kuzzle provides them all off the shelf, allowing you to focus on building **high-level, high-value business functionalities**.

## API First

The majority of Kuzzle's features are available via its API for various external clients.

This **multi-protocol API** allows clients to communicate with Kuzzle and use the backend features through the **protocol that best suits their needs**:
- HTTP
- WebSocket 
- MQTT
- Or any IP protocol

Whether it is the creation and modification of the database or the management of users and rights, **everything is available through the different controllers of the API**.

The API provides a **standard communication format** for requests and responses so that every client has an identical experience with the API.

Access to every action is **centralized within the rights management system** for a better understanding and maintenance.

## Ready-to-use Database

Kuzzle uses Elasticsearch as a NoSQL document store.

With Kuzzle, customers **can directly access data stored in the database** as long as they have the rights to do so.

Kuzzle exposes the Elasticsearch Query Language in a secure way. It is therefore possible to **take full advantage of the possibilities of Elasticsearch** with boolean queries, aggregations, special fields, etc.

It is then **no longer needed to create a new controller every time new data needs to be displayed**, and it is no longer needed to add parameters to controller actions to refine searches either: **queries are expressed directly on the client side**.


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
});
```

In the same way, creating collections or writing documents is also done directly from the frontend into the database collections:

```js
// First create an index and a collection to handle our data
await sdk.index.create('iot');
await sdk.collection.create('iot', 'sensors', {
  mappings: {
    model: { type: 'keyword' },
    temperature: { type: 'integer' },
  }
});

// Create a document inside our collection
let result = await sdk.document.create('iot', 'sensors', {
  model: 'temperature',
  temperature: 42
});
```

## Authentication

Kuzzle features a [multi-authentication system](/core/2/guides/main-concepts/authentication) for all users and fits perfectly in a **context of SSO and centralization of authentication** within an information system.

Rather than using a single authentication system, Kuzzle embeds [Passport.js](http://www.passportjs.org/) and **makes its 500+ authentication strategies available to you** by writing an authentication plugin.

Your users can then choose to authenticate themselves with a classic **login / password** but also from an **OAuth** provider such as Facebook or Google, a **LDAP directory**, via **SAML**, or many other methods.

## Rights Management

[Rights Management](/core/2/guides/main-concepts/permissions) is also integrated in the backend functionalities. The **rights can be configured through the Kuzzle API** or through our Admin Console.

Kuzzle has a **standard system with 3 levels of depth**:
- Roles control access to API actions,
- Profiles are a composition of multiple roles,
- Finally, users are a composition of multple profiles.

![Users, Profiles and Roles diagram](./profiles-roles.png)

This system allows management of the majority of access control rights situations. For the most advanced cases, Kuzzle **allows to dynamically restrict access rights** via its event system and its pipe mechanism.

```ts
// Restrict document reading to their creator only
app.pipe.register('generic:document:afterGet', async (documents: Document[], request: KuzzleRequest) => {
  for (const document of documents) {
    if (request.context.user._id !== document._source._kuzzle_info.creator) {
      throw new ForbiddenError(`Not allowed to access document ${document._id}`);
    }
  }

  return documents;
});
```

## Extensibility

Like any framework, Kuzzle allows you to **develop new features by extending and modifying the existing API**.

To do so, just install the [NPM kuzzle package](https://www.npmjs.com/package/kuzzle) and start developing your application.

```js
import { Backend, KuzzleRequest } from 'kuzzle';

const app = new Backend('iot-tracker');

// Register a new API controller
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: (request: KuzzleRequest) => `Hello, ${request.input.args.name}`
    }
  }
});

app.start()
  .then(() => app.log.info('Application started'));
```

Kuzzle offers different mechanisms to **develop the business functionalities** of your application:
 - [API Controller](/core/2/guides/develop-on-kuzzle/api-controllers)
 - [Event System](/core/2/guides/develop-on-kuzzle/event-system)
 - [External Plugin](/core/2/guides/develop-on-kuzzle/external-plugins)

Everything you will build upon your application will **benefit from the advantages of Kuzzle API** such as multi-authentication, rights management, standard request and response format, cluster scalability, anti-DoS protection, etc.

## Typescript support

Kuzzle exposes [interfaces written in Typescript](/core/2/framework/classes) for a **faster learning curve** and a **better application maintainability**.

This support is available for writing backend applications as well as frontend applications.

Whether in the backend or in the frontend, **developers use the same interface to interact with Kuzzle**: [Kuzzle Javascript SDK](/sdk/js/7/getting-started/node-js)

The Javascript SDK is of course used by frontend applications but also in the backend, so developers can capitalize on their experience to **allow isomorphic backend / frontend development**.

## Realtime Notifications

Kuzzle has its own [high-performance realtime engine](/core/2/guides/main-concepts/realtime-engine).  

This engine allows you to use pub/sub communications in a conventional way, but it's also capable of triggering [realtime database notification](/core/2/guides/main-concepts/realtime-engine#database-notifications).

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
  console.log(`Sensor ${notification.result._id} temperature is too high!`);
});
```

The entire realtime engine is used exclusively from a client (frontend or backend) and **does not require any additional code on the Kuzzle application side** to generate and transmit notifications.

## Integrated Cluster Mode

Kuzzle is a backend designed to **scale horizontally to millions of users**.  

With its integrated [masterless cluster mode](/core/2/guides/advanced/cluster-scalability), it allows hot-starting new application instances to handle any additionnal load.

In addition to allowing scalability, the cluster mode **offers high availability to reach 99.99% uptime** for your application.

It is also possible to start your application by deploying it on a single server and then deploy the same code on several servers whenever there is a need to handle a heavier load.

## Get Started !

Follow our Getting Started to develop your first server application: [Kuzzle application journey](/core/2/guides/getting-started/run-kuzzle)

Or start to develop a client application by using one of our [SDKs](/sdk):

### Backend
 - [Node.js](/sdk/js/7/getting-started/node-js)
 - [Java](/sdk/jvm/1/getting-started/java)
 - [Kotlin](/sdk/jvm/1/getting-started/kotlin)
 - [C# .NET Core](/sdk/csharp/2/getting-started/standalone)
 
### Frontend Web
 - [React.js](/sdk/js/7/getting-started/react/standalone)
 - [Vue.js](/sdk/js/7/getting-started/vuejs/standalone)
 - [Webpack](/sdk/js/7/getting-started/webpack)
 - [Vanilla JS](/sdk/js/7/getting-started/raw-web)

### Frontend Mobile

 - [React Native](/sdk/js/7/getting-started/react-native)
 - [Flutter](/sdk/dart/2/getting-started/flutter)
 - [Kotlin](/sdk/jvm/1/getting-started/kotlin)
 - [Java](/sdk/jvm/1/getting-started/java)
 - [C# .NET Core](/sdk/csharp/2/getting-started/standalone)
