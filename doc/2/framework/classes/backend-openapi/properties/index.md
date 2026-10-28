---
code: false
type: page
title: Properties | Framework | Core

description: BackendOpenApi class properties
---

# BackendOpenApi

<SinceBadge version="2.17.0" />

The `BackendOpenApi` class handles OpenAPI definition.

It is accessible from the [Backend.openApi](/core/2/framework/classes/backend/properties#openapi) property.

See the [OpenAPI](/core/2/guides/develop-on-kuzzle/api-controllers#openapi-specification) guide.

## `definition`

| Type                                                                                 | Description        | get / set |
| ------------------------------------------------------------------------------------ | ------------------ | --------- |
| <pre>Partial<[OpenApiDefinition](/core/2/framework/types/openapi-definition)></pre> | OpenAPI definition | get / set |

**Example:** _Default content of the OpenAPI definition_

```js
app.openApi.definition

/*
{
  openapi: '3.1.0',
  info: {
    title: `${application.name} API`,
    description: `${application.name} HTTP API definition`,
    contact: {
      name: 'Kuzzle team',
      url: 'https://kuzzle.io',
      email: 'support@kuzzle.io',
    },
    license: {
      name: 'Apache 2',
      url: 'http://opensource.org/licenses/apache2.0',
    },
    version: application.version,
  },
  externalDocs: {
    description: 'Kuzzle API Documentation',
    url: 'https://docs.kuzzle.io/core/2/api/',
  },
  tags: [],
  schemes: ['https', 'http'],
  paths: {},
}
*/
```
