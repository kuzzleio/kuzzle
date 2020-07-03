---
code: false
type: page
title: Introduction
description: How to develop your custom application using Kuzzle
order: 0
---

# Introduction

Kuzzle offers many ready-to-use features.  
However most of the time you will need to develop your own features adapted to your business logic.

An API is available to allow developers to extend the functionality of Kuzzle by creating an application.  

[See Key Concepts]

## Controllers

Controllers are used to declare new API actions.  

These actions are simply functions receiving a [Request object] and returning a result.

The API actions thus declared are available via the currently activated protocols (Http, WebSocket, MQTT, etc.).

[Controllers documentation].

## Internal Events

WIth Kuzzle, almost every interactions generates an event to which it is possible to react.

These actions can be the reception of a request, the beginning of the execution of an API action, an error, etc.  

[Complete list of Kuzzle events]

Pipes and Hooks are the two ways to interact with these events.

### Pipes

Event pipes allow to modify the execution flow of a request.

Pipes are simply functions receiving a request or another type of payload as a parameter and having to return it so that Kuzzle continues the execution cycle.

If a pipe raises an exception then the execution cycle will be interrupted and Kuzzle will respond to the original request with the corresponding error.

Data enrichment before storage or a finer management of user rights are good examples of using pipes.

[Pipe documentation]

### Hooks

Event hooks allow you to react to the execution of a request.

Like pipes, hooks are functions that receive a [Request object] or another type of payload as a parameter.

Their execution is done in parallel with the execution cycle of the request. Hooks cannot therefore intervene on the execution cycle.

Hooks can be used for the execution of tasks that can slow down the response time of the request without being necessary for its execution.

Sending emails or notifications to an external service are good examples of hooks usage.

[Hooks documentation]

## Plugins

Plugins are Node.js modules bringing new features to your application.

They can be distributed via NPM but they can also be installed from the filesystem.

Plugins offer about the same possibilities to extend the functionality of Kuzzle as an application except that they are generally designed to be reusable between several projects.

[Plugins documentation]

