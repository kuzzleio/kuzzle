---
code: false
type: page
order: 100
title: What is Kuzzle | Kuzzle Introduction | Guide | Core
meta:
  - name: description
    content: Why are we spending so much time developing our backend?
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, What is kuzzle
---

# Why Choose a Ready-Made Backend?

If you're here, you're probably planning to build a backend system for your:
- Mobile application
- Web platform
- IoT project

## The Traditional Approach

Your first instinct might be to:
1. Build everything from scratch
2. Use a framework to speed things up

While frameworks provide helpful structures and patterns, you'll still need to implement fundamental features like:
- Database operations and search functionality
- Permission systems
- User authentication
- API endpoints

## The Hidden Cost

Building these basic components isn't just about writing code. It involves:
- Extensive debugging
- Security hardening
- Testing
- Ongoing maintenance

This represents significant time spent on infrastructure rather than value-adding features.

## What You Could Focus On Instead

The time saved could be better invested in:
- Core business features
- Frontend experience
- Comprehensive testing
- DevOps optimization
- Marketing initiatives

## The Solution: Kuzzle

This is why Kuzzle was created - a pre-built backend platform that handles all the foundational elements, allowing developers to focus on what truly matters: building distinctive features for their users.

Think of it as skipping the "infrastructure homework" and jumping straight to the unique aspects of your application.


## How it works

Kuzzle is a **backend with ready-to-use features** that can be extended in the same way as any other framework.

When you start Kuzzle, you automatically have access to an API exposing a wide range of features:


<div class="IconTable">
  <div class="IconTable-item">
    <div class="IconTable-item-icon">
      <img src="./feature-data-storage.svg" alt="database illustration"/>
    </div>
    <div class="IconTable-item-text">
      <a target="_blank" href="/core/2/guides/main-concepts/data-storage">Data storage and access</a>
    </div>
  </div><div class="IconTable-item">
    <div class="IconTable-item-icon">
      <img src="./feature-acl.svg" alt="Advanced permission system illustration"/>
    </div>
    <div class="IconTable-item-text">
      <a target="_blank" href="/core/2/guides/main-concepts/permissions">Advanced permission system</a>
    </div>
  </div><div class="IconTable-item">
    <div class="IconTable-item-icon">
      <img src="./feature-auth.svg" alt="authentification illustration"/>
    </div>
    <div class="IconTable-item-text">
      <a target="_blank" href="/core/2/guides/main-concepts/authentication">Multi authentication</a>
    </div>
  </div><div class="IconTable-item">
    <div class="IconTable-item-icon">
      <img src="./feature-api.svg" alt="api illustration"/>
    </div>
    <div class="IconTable-item-text">
      <a target="_blank" href="/core/2/guides/main-concepts/api">Multi protocol API (Http, WebSocket, MQTT)</a>
    </div>
  </div><div class="IconTable-item">
    <div class="IconTable-item-icon">
      <img src="./feature-realtime.svg" alt="realtime engine illustration"/>
    </div>
    <div class="IconTable-item-text">
      <a target="_blank" href="/core/2/guides/main-concepts/realtime-engine">Realtime engine</a>
    </div>
  </div><div class="IconTable-item">
    <div class="IconTable-item-icon">
      <img src="./feature-cluster.svg" alt="cluster interconnected illustration"/>
    </div>
    <div class="IconTable-item-text">
      <a target="_blank" href="/core/2/guides/advanced/cluster-scalability">Integrated cluster mode</a>
    </div>
  </div>
</div>


You can also develop your custom business and high level features by [extending Kuzzle API](/core/2/guides/develop-on-kuzzle/api-controllers) or [modifying API methods behavior](/core/2/guides/develop-on-kuzzle/event-system#pipe).

**Example:** Basic Kuzzle application
```js
import { Backend } from 'kuzzle';

// Instantiate a new application
const app = new Backend('playground');

// Declare a "greeting" controller
app.controller.register('greeting', {
  actions: {
    // Declare a "sayHello" action
    sayHello: {
      handler: request => `Hello, ${request.input.args.name}`
    }
  }
});

// Start the application
app.start()
  .then(() => {
    app.log.info('Application started');
  });
```

## Complete ecosystem

In addition to Kuzzle, we are developing many other projects to facilitate the use of our backend.   

These projects are available under the Apache-2 license on [Github](https://github.com/kuzzleio).

### Admin Console

The [Admin Console](https://next-console.kuzzle.io) is a Single Page Application (SPA) written in Vue.js.  

It is used to manage its data and the user permissions system.

As it is a single-page application (SPA), no data related to your Kuzzle application will pass through our servers, so you can use the online version available at [http://next-console.kuzzle.io](http://next-console.kuzzle.io).

![Screenshot of the admin console interface](./ecosystem-admin-console.png)

### SDKs

We provide many SDKs to facilitate the use of Kuzzle in applications.  

These SDKs are available for the most common languages and the majority of frontend development platforms:
 - [Javascript / Typescript](/sdk/js/7) : [Node](/sdk/js/7/getting-started/node-js), [React](/sdk/js/7/getting-started/react/standalone), [React Native](/sdk/js/7/getting-started/react-native), [Vue.js](/sdk/js/7/getting-started/vuejs/standalone), Angular, etc
 - [Dart](/sdk/dart/2) : [Flutter](/sdk/dart/2/getting-started/flutter)
 - [Csharp](/sdk/csharp/2) : Xamarin, [.NET](/sdk/csharp/2/getting-started/standalone)
 - [Java / Kotlin](/sdk/jvm/1) : Android, JVM

![List of sdk (js java, c#, kotln dart, go) and platforms (react / react native, android studio, flutter, xamarin, angular, node, vuejs, microsoft.net)](./ecosystem-sdk-platforms.png)

### Kourou

Kourou is a command line interface that speeds up development with Kuzzle.

It can be used to execute any API action or even code snippets directly.

[See Kourou on Gitub](https://github.com/kuzzleio/kourou)

### Business plugins

We also develop and distribute plugins for Kuzzle.  

These plugins allow you to use the functionalities of other services such as [Amazon S3](https://docs.kuzzle.io/official-plugins/s3/2) or [Prometheus](https://github.com/kuzzleio/kuzzle-plugin-prometheus).

The community is also able and encouraged to develop and distribute its own plugins to enrich the ecosystem.

![List of business plugins](./ecosystem-business-plugins.png)


### Expert Professional Support

The Kuzzle backend and all our projects are developed by a team of engineers based in Montpellier, France.  

Our multidisciplinary team of experts is capable of addressing any type of issue and assisting projects of all sizes.

You can thus pass the development and production phases with a relaxed spirit, knowing that you can rely on quality professional support.

[Get a quote](https://info.kuzzle.io/contact-us)
