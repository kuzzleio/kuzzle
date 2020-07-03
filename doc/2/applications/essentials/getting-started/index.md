---
code: false
type: page
title: Getting Started
description: Develop your first application with Kuzzle
order: 1
---

# Getting Started

In this tutorial, we will see how to start developing our first application with Kuzzle.

Summary:
 - [Setting up the environment]
 - [Running Kuzzle application]
 - [Extend the API with a new action]
 - [Modifying an existing action with a pipe]
 - [Running parallel processing with a hook]

Before proceeding, please make sure your system has the following requirement:
 - Node.js 12.x or higher
 - Docker

## Setting up the environment

We are going to set up a development environment adapted to Kuzzle

First of all, we will need to have a Redis and Elasticsearch instances available.

We will use Docker and launch the following containers:

```bash
$ docker run -d -p 6379:6379 redis:5
$ docker run -d -p 9200:9200 kuzzleio/elasticsearch:7
```

::: info
Elasticsearch may take a few seconds to start.
:::

Then we will create a directory for our application, initialize an NPM module and install Kuzzle:

```bash
$ mkdir kuzzle
$ cd kuzzle/
$ npm init
$ npm install kuzzle
```

Everything is now ready for us to start developing.

## Running Kuzzle application

We will now create an `index.js` file that will contain the code for our application.

The first step is to import the [Backend] class from the [kuzzle] package and initialize our application.

```js
const { Backend } = require('kuzzle');

const app = new Backend('yoga-app');
```

The argument passed to the constructor is the name of your application.

We will then call the [Backend.start] method to start our application.

For the moment we haven't added any functionality but the basic features of Kuzzle will still be available.

```js
const { Backend } = require('kuzzle');

const app = new Backend('yoga-app');

const run = async () => {
  try {
    console.log(`Application "${app.name}" successfully started!`);
  }
  catch (error) {
    console.log(`Error starting "${app.name}": ${error})`);
  }
};

run();
```

We can now run our application:

```bash
$ node index.js
[ℹ] Starting Kuzzle 2.3.0 ...
[✔] Cache engine initialized
[✔] Storage engine initialized
[✔] Successfully loaded 2 plugins: kuzzle-plugin-auth-passport-local, kuzzle-plugin-logger
[✔] Core components loaded
[✔] Kuzzle 2.3.0 is ready
[yoga-app]: Application "yoga-app" successfully started!
```

You can check it by opening the following url in your browser: [http://localhost:7512](http://localhost:7512)

::: warning
Each time we will add new features it will be necessary to restart the application.
:::

Going further:
 - [Application Boilerplate]

## Extend the API with a new action

New API actions are declared by using a structure called a controller.

Each controller must be registered using the [Backend.controller.register] method.  

The first parameter is the name of the controller and the second is the description of its actions.

Each action must define a "handler", i.e. a function that will be executed each time the action is called via the API.

::: info
The handler of an action must return a promise. The result of this promise will be sent in the response within the `result' field.
:::


```js
// register a controller named "greetings"
app.controller.register('greetings', {
  actions: {
    // declare an action called "hello"
    helloWorld: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`;
      }
    }
  }
});
```

By default, Kuzzle generates an Http route for your actions in the following form: `GET /_/<controller>/<action>`.
Controller and action names will be converted to kebab-case.

To test our action we can visit the following url: [http://localhost:7512/_/greetings/hello-world?name=Queen%20May](http://localhost:7512/_/greetings/hello-world?name=Queen%20May)

Going further:
 - [Request Input]
 - [Request class]
 - [Rights management]

## Modifying an existing action with a pipe

We will now use a pipe registered to a Kuzzle event to modify the behavior of an existing action.

A pipe is a function that will be executed each time the corresponding event is triggered.

Pipes must be registered with the [Backend.pipe.register] method.  
The first parameter is the event name and the second is the function that will be executed.

We will register a pipe on the [server:afterNow] event that is triggered after the [server:now] action.

::: info
The registered function must return a promise resolving the request passed in parameter so that it is then passed to the next pipes or to Kuzzle.
:::

```js
app.pipe.register('server:afterNow', async request => {
  // Returns date in UTC format instead of timestamp
  request.result.now = (new Date()).toUTCString();

  return request;
});
```

Let's now call the action [server:now] by opening the following URL in our browser: [http://localhost:7512/_now](http://localhost:7512/_now)

Going further:
 - [Pipes documentation]
 - [Events list]
 - [Request Input]
 - [Request class]

## Running parallel processing with a hook

We will use a hook registered on a Kuzzle event to perform parallel processing.

A hook is a function that will be executed each time the corresponding event is triggered.

Hooks must be registered with the [Backend.hook.register] method.  
The first parameter is the event name and the second is the function that will be executed.

We will register a hook on the [server:beforeNow] event that is triggered before the [server:now] action.

```js
app.hook.register('server:beforeNow', request => {
  app.log.info('Someone is accessing the "server:now" action');
});
```

Let's now call the action [server:now] by opening the following URL in our browser: http://localhost:7512/_now

You should see the message in your application logs.

Going further:
 - [Hooks documentation]
 - [Events list]
 - [Request Input]
 - [Request class]

## Final application

```js
const { Backend } = require('../index');

const app = new Backend('lambda-core');

app.controller.register('greetings', {
  actions: {
    // declare an action called "hello"
    helloWorld: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`;
      }
    }
  }
});

app.pipe.register('server:afterNow', async request => {
  // Returns date in UTC format instead of timestamp
  request.result.now = (new Date()).toUTCString();

  return request;
});

app.hook.register('server:beforeNow', request => {
  app.log.info('Someone is accessing the "server:now" action');
});

const run = async () => {
  try {
    console.log(`Application "${app.name}" successfully started!`);
  }
  catch (error) {
    console.log(`Error starting "${app.name}": ${error})`);
  }
};

run();
```