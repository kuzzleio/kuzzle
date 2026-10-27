---
code: false
type: page
title: DefaultMappings | Framework | Core

description: DefaultMappings type definition
---

# DefaultMappings

The `DefaultMappings` type describes the indexes and collections imported with [Backend.import.mappings](/core/2/framework/classes/backend-import/mappings).

```ts
type DefaultMappings = {
  [index: string]: {
    [collection: string]: {
      mappings: JSONObject;
      settings?: JSONObject;
    };
  };
};
```

| Property   | Type                                                         | Description                                                                                                       |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `mappings` | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | [Collection mappings](/core/2/guides/main-concepts/data-storage#collection-mappings)                               |
| `settings` | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | (optional) Elasticsearch index settings of the collection                                                         |

**Example:**

```ts
import { DefaultMappings } from 'kuzzle';

const mappings: DefaultMappings = {
  'nyc-open-data': {
    'yellow-taxi': {
      mappings: {
        properties: {
          licence: { type: 'keyword' }
        }
      }
    }
  }
};

app.import.mappings(mappings);
```
