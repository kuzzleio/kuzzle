---
code: false
type: page
title: Constructor | Framework | Core

description: Backend class constructor
---

# Backend

<SinceBadge version="2.8.0" />

The `Backend` class is the **entry point** of a Kuzzle application.  

It must be instantiated in order to create a new application.  

It gives access to the different features of the framework through its properties.

---

## Constructor

```js
new Backend(name)
```

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | ---------------- |
| `name`              | <pre>string</pre> | Application name |

The constructor also:

- sets the global variable `app` to this instance,
- defines the read-only global variable `nodeId`, holding the generated cluster node identifier.

## Errors

- [plugin.assert.invalid_application_name](/core/2/api/errors/error-codes/plugin#subdomain-0x0401-assert): the name is not a valid application name (lowercase letters, digits and dashes only)
