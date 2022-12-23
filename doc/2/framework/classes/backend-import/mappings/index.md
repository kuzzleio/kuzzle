---
code: true
type: page
title: mappings | Framework | Core

description: BackendImport.mappings method
---

# `mappings()`

<SinceBadge version="2.14.0" />

Loads mappings into the app.

This method is idempotent. If a collection mappings is defined multiple times, only the last definition will be retained.

::: info
This method can only be used before the application is started.
:::

```ts
mappings(mappings: JSONObject): void
```

<br/>

| Argument   | Type                  | Description                   |
|------------|-----------------------|-------------------------------|
| `mappings` | <pre>JSONObject</pre> | Object containing index and their collection [mappings](/core/2/guides/main-concepts/data-storage#mappings-properties). |

## Usage

```js
app.import.mappings({
  index1: {
    collection1: {
      mappings: {
        dynamic: 'strict',
        _meta: {
          field: 'value',
        },
        properties: {
          fieldA: { type: 'keyword'},
          fieldB: { type: 'integer'}
        },
      },
      settings: {
        analysis : {
          analyzer:{
            content:{
              type:'custom',
              tokenizer:'whitespace'
            }
          }
        }
      }
    },
    collection2: {
      mappings: {
        properties: {
          fieldC: {
            type: 'keyword'
          }
        }
      }
    },
  },
  index2: {
    collection1: {
      mappings: {
        properties: {
          fieldD: {
            type: 'integer'
          }
        }
      }
    },
  },
})
```
