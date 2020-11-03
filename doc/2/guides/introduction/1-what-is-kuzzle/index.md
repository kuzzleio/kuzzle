---
code: false
type: page
title: What is Kuzzle
description: Why are we spending so much time developing our backend?
order: 100
---

# What is Kuzzle

If you're on this page it's probably because **you need a backend** for your mobile, web or IoT application.

Once again you had been **preparing to develop a backend from scratch**... Well, maybe not entirely from scratch, because you probably planned to use some kind of framework (and there are a lot of them!) to make it easier for you.  
Those frameworks allow you to develop faster by providing a predefined structure, classes and configurations.

However, you will still have to develop the majority of the basic features:
 - Storing and searching data
 - Permission management
 - User authentication
 - Access to data and functionalities through an API

Each of **these features will take time**. Time to develop but also time to:
 - Debug
 - Test 
 - Maintain
 - Secure

In short, you were going to spend a lot of time on **code that doesn't bring any value to your users** but is nevertheless essential.

This time could have been used for many other things:
 - Development of business functionalities
 - UI / UX of frontend applications
 - 100% coverage by automated tests
 - Implementation of devops best practices
 - Marketing of your product
 - ...

It is on the basis of this failure to optimize development time that we decided to start developing Kuzzle 5 years ago and that we have been devoting all our efforts to it ever since.

## How it works

Kuzzle is a **backend with ready-to-use features** that can be extended in the same way as any framework.

When you start Kuzzle, you automatically have access to an API exposing a wide range of features:

<IconTable :items="[
  { text: 'Data storage and access', icon: 'guides/introduction/1-what-is-kuzzle/feature-data-storage.svg' },
  { text: 'Advanced permission system', icon: 'guides/introduction/1-what-is-kuzzle/feature-acl.svg' },
  { text: 'Multi authentication', icon: 'guides/introduction/1-what-is-kuzzle/feature-auth.svg' },
  { text: 'Multi protocol API (Http, WebSocket, MQTT)', icon: 'guides/introduction/1-what-is-kuzzle/feature-api.svg' },
  { text: 'Realtime engine', icon: 'guides/introduction/1-what-is-kuzzle/feature-realtime.svg' },
  { text: 'Integrated cluster mode', icon: 'guides/introduction/1-what-is-kuzzle/feature-cluster.png' },
]"/>

Then you can develop your custom business and high level features by [extending Kuzzle API](/core/2/some-link) or [modifying API methods behavior](/core/2/some-link).

## Complete ecosystem

In addition to Kuzzle, we are developing many other projects to facilitate the use of our backend.   

All these projects are also available under the Apache-2 license on [Github](https://github.com/kuzzleio).

### Admin Console

The [Admin Console](/core/2/some-link) is a Single Page Application (SPA) written in Vue.js.  

It is used to manage its data and the user permissions system.

As it is a single-page application (SPA), no data related to your Kuzzle application will pass through our servers, so you can use the online version available at [http://next-console.kuzzle.io](http://next-console.kuzzle.io).

### SDKs

We develop many SDKs to facilitate the use of Kuzzle in applications.  

These SDKs are available for the most common languages and the majority of frontend development platforms:
 - [Javascript / Typescript](/sdk/js/7) : [Node](/sdk/js/7/getting-started/node-js/), [React](/sdk/js/7/getting-started/react/standalone/), [React Native](/sdk/js/7/getting-started/react-native/), [Vue.js](/sdk/js/7/getting-started/vuejs/standalone/), Angular, etc
 - [Dart](/sdk/dart/2) : [Flutter](/sdk/dart/2/getting-started/flutter/)
 - [Csharp](/sdk/csharp/2) : Xamarin, [.NET](/sdk/csharp/2/getting-started/standalone/)
 - [Java / Kotlin](/sdk/some/link) : Android, JVM

### Kourou

Kourou is a command line interface that facilitates development with Kuzzle.

It can be used in particular to execute any API action or even code snippets directly.

[See the dedicated guide](/some/link/kourou)

### Business plugins

We also develop and distribute plugins for Kuzzle.  

These plugins allow you to use the functionalities of other services such as [Amazon S3](https://docs.kuzzle.io/official-plugins/s3/2) or [Prometheus](https://github.com/kuzzleio/kuzzle-plugin-prometheus).

The community is also able to develop and distribute its own plugins to enrich the ecosystem.

### Meet the community

We federate a community of developers using Kuzzle around the world.

Whether you want to ask a question about [StackOverflow](https://stackoverflow.com/questions/ask?tags=kuzzle), check out the [Kuzzle awesome list](https://github.com/kuzzleio/awesome-kuzzle) or discuss Kuzzle usage on [Discord](http://join.discord.kuzzle.io), the community and the core team will be there to help you.
