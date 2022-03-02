---
code: true
type: page
title: register
description: BackendErrors register method
---

# register

<SinceBadge version="2.17.1" />

Register a new standard KuzzleError

## Arguments

```js
register (subDomain: string, name: string, definition: CustomErrorDefinition): void
```

| Argument | Type | Description |
|----------|------|-------------|
| `subDomain` | <pre>string</pre> | Subdomain name |
| `name` | <pre>string</pre> | Standard error name |
| `definition` | <pre>CustomErrorDefinition</pre> | Standard error definition |


### Example

```js
app.errors.register('api', 'custom', {
  class: 'BadRequestError',
  description: 'This is a custom error from API subdomain',
  message: 'Custom %s error',
});
```