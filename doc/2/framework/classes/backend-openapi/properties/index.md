---
code: false
type: page
title: Properties
description: BackendOpenApi class properties
---

# BackendOpenApi

<SinceBadge version="2.17.0" />

The `BackendOpenApi` class handles OpenAPI definition.

It is accessible from the [Backend.openapi](/core/2/framework/classes/backend/properties#openapi) property.

See the [OpenAPI](/core/2/guides/develop-on-kuzzle/api-controller#openapi-specification) guide.

## `definition`

| Type                           | Description                  |
|--------------------------------|------------------------------|
| <pre>JSONObject</pre> | OpenAPI definition |

**Example:** _Default content of OpenAPI definition_

```js
app.openApi.definition

/*
{
  swagger: '2.0',
  info: {
    title: `${application.name} API`,
    description: `${application.name} HTTP API definition`,
    contact: {
      name: 'Kuzzle team',
      url: 'https://kuzzle.io',
      email: 'support@kuzzle.io',
      discord: 'http://join.discord.kuzzle.io'
    },
    license: {
      name: 'Apache 2',
      url: 'http://opensource.org/licenses/apache2.0'
    },
    version: application.version
  },
  externalDocs: {
    description: 'Kuzzle API Documentation',
    url: 'https://docs.kuzzle.io/core/2/api/'
  },
  servers: [
    {
      url: 'https://{baseUrl}:{port}',
      description: `${application.name} Base Url`,
      variables: {
        baseUrl: { default: 'localhost' },
        port: { default: 7512 },
      }

    }
  ],
  tags: [],
  schemes: [ 'https', 'http' ],
  paths: {},
  components: {}
};
*/

```
