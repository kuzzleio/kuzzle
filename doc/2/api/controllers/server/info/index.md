---
code: true
type: page
title: info
---

# info



Returns information about Kuzzle: available API (base + extended), plugins, external services (Redis, Elasticsearch, ...), servers, etc.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512
URL(2): http://kuzzle:7512/_serverInfo
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "info"
}
```

---

## Response

Returns a serverInfo object with the following properties:

- `kuzzle`: kuzzle information about its API, active plugins, and system information
- `services`: description and status of external services (e.g. Redis, Elasticsearch, ...)

```js
{
  "status": 200,
  "error": null,
  "controller": "server",
  "action": "info",
  "result": {
    "serverInfo": {
      "kuzzle": {
        "api": {
          "routes": {
            // complete exposed API documentation
            // example:
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
            }
          }
        },
        "memoryUsed": 115036160,
        "nodeVersion": "v10.16.2",
        "plugins": {
          // plugins information
          // example:
          "kuzzle-plugin-auth-passport-local": {
            "manifest": {
              "name": "kuzzle-plugin-auth-passport-local",
              "path": "/var/app/plugins/enabled/kuzzle-plugin-auth-passport-local",
              "kuzzleVersion": ">=2.0.0 <3.0.0"
            },
            "hooks": [],
            "pipes": [],
            "controllers": [],
            "routes": [],
            "strategies": [ "local" ]
          }
        },
        "system": {
          "cpus": [
            // list of CPUs
          ],
          "memory": {
            "total": 16420540416,
            "free": 1214001152
          },
        },
        "uptime": "98436.853s",
        "version": "<kuzzle version>"
      },
      "services": {
        // external services list, description and status
      }
    }
  }
}
```
