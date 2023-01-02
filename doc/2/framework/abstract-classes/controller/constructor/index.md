---
code: true
type: page
title: constructor | Framework | Core

description: Controller abstract class constructor
---

# constructor

<SinceBadge version="2.8.0" />

Constructor method of the `Controller` abstract class. It must be called with the [Backend](/core/2/framework/classes/backend) class instantiated by the application.

## Arguments

```ts
constructor (app: Backend);
```

<br/>

| Argument  | Type   | Description            |
| -------------- | --------- | ------------- |
| `app` | <pre>Backend</pre> | Instantiated application [Backend](/core/2/framework/classes/backend) class |

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
