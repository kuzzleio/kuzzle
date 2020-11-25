---
code: true
type: page
title: constructor
description: Controller abstract class constructor
---

# Controller Constructor

Constructor method of the `Controller` abstract class. It must be called with the [Backend](/core/2/framework/some-link) class instantiated by the application.

## Arguments

```ts
constructor (app: Backend);
```

<br/>

| Argument  | Type   | Description            |
| -------------- | --------- | ------------- |
| `app` | <pre>Backend</pre> | Application instantiated [Backend](/core/2/framework/some-link) class |

## Usage

```ts
import { Controller } from 'kuzzle';

class GreetingController extends Controller {
  constructor (app: Backend) {
    super(app);

    // [...]
  }
}
```
