---
code: true
type: page
title: publicApi
---

# publicApi


Returns available API routes, including both Kuzzle's and plugins'.  

::: warning
This route is used by the HTTP protocols of the SDKs to build requests based on the controller and action names.  
Disabling this route for the anonymous user may limit SDKs features.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_publicApi
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "publicApi"
}
```

---

## Response

Returns an object containing the definition of the available API.  
Each key matches an API controller.


```js
{
  "status": 200,
  "error": null,
  "controller": "server",
  "action": "publicApi",
  "result": {
    "auth": {
      "login": {
        "controller": "auth",
        "action": "login",
        "http": [
            {
                "url": "/_login/:strategy",
                "verb": "GET"
            },
            {
                "url": "/_login/:strategy",
                "verb": "POST"
            }
        ]
      }
    },
    "plugin-test/example": {
      "liia": {
        "controller": "plugin-test/example",
        "action": "liia",
        "http": [
          {
            "url": "_plugin/plugin-test/liia",
            "verb": "GET"
          }
        ]
      }
    }
  }
}
```
