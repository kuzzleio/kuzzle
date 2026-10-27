---
code: false
type: page
title: HttpRoute | Framework | Core

description: HttpRoute type definition
---

# HttpRoute

The `HttpRoute` type describes an HTTP route of an API action, in the `http` array of a [ControllerDefinition](/core/2/framework/types/controller-definition) action.

| Property  | Type                                                         | Description                                                                                                                                                         |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verb`    | <pre>string</pre>                                            | HTTP verb: `get`, `head`, `post`, `put`, `delete`, `patch` or `options`                                                                                             |
| `path`    | <pre>string</pre>                                            | Route path. A path starting with `/` is added as is; any other path is prefixed with `/_/`, which avoids conflicts with the standard API routes. Path parameters are written `:name` |
| `openapi` | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | (optional) [OpenAPI v3 path item](https://swagger.io/specification/#paths-object) of the route. When it is not given, Kuzzle generates one from the action definition |

An action with no `http` property, or an empty one, gets a default route: `GET /_/<controller>/<action>`, with both names in kebab-case. See [HTTP routes](/core/2/guides/develop-on-kuzzle/api-controllers#http-routes).

**Example:**

```ts
import { HttpRoute } from 'kuzzle';

const route: HttpRoute = {
  verb: 'post',
  path: 'greeting/hello/:name',
  openapi: {
    description: 'Simply say hello',
    responses: {
      200: { description: 'Custom greeting' }
    }
  }
};

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => `Hello, ${request.getString('name')}`,
      http: [route]
    }
  }
});
```
