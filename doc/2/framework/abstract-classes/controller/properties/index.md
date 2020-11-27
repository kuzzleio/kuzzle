---
code: false
type: page
title: Properties
description: Controller abstract class properties
---

# Controller

The `Controller` abstract class is the base class used to declare new controllers. Those controllers instances are meant to be used with the [BackendController.use](/core/2/framework/classes/backend-controller) method.

See also the [API Controllers](/core/2/guides/develop-on-kuzzle/2-api-controllers) guide.

## `app`

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>[Backend](/core/2/framework/classes/backend)</pre> | Reference to the instantiated [Backend](/core/2/framework/classes/backend) class |

## `name`

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>string</pre> | Optional controller name. It will be inferred from the class name if not set |

## `definition`

This property is an instance of the [BackendStorage](/core/2/framework/classes/backend-storage) class that allows to interact directly with Elasticsearch.  

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>[ControllerDefinition](/core/2/framework/types/controller-definition)</pre> | A valid [ControllerDefinition](/core/2/framework/types/controller-definition) object defining the controller actions list. |
