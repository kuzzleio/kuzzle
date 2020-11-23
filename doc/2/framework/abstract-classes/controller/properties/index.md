---
code: false
type: page
title: Properties
description: Controller abstract class properties
---

# Controller

The `Controller` abstract class is the base class to declare new controllers meant to be used with the [Backend.controller.use](/core/2/framework/some-link) method.

See also the [API Controllers](/core/2/guides/develop-on-kuzzle/2-api-controllers) guide.

## Properties

| Name              | Type                              | Description |
|-------------------|-----------------------------------|-------------|
| app | <pre>Backend</pre> | Reference to the instantiated [Backend](/core/2/framework/some-link) class.  |
| name | <pre>string</pre> | Optionnal controller name. It will be inferred from the class name if not set.  |
| definition | <pre>ControllerDefinition</pre> | A valid [ControllerDefinition](/core/2/framework/interfaces/controller-definition) that define the controller actions list.  |
