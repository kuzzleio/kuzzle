---
code: true
type: page
title: get | Framework | Core

description: BackendErrors get method
---

# get

<SinceBadge version="2.17.1" />

Get a standardized KuzzleError

## Arguments

```js
get (domain: string, subDomain: string, name: string, ...placeholders: unknown[]): KuzzleError
```

| Argument       | Type              | Description                 |
| -------------- | ----------------- | --------------------------- |
| `domain`       | <pre>string</pre> | Domain name                 |
| `subDomain`    | <pre>string</pre> | Subdomain name              |
| `name`         | <pre>string</pre> | Standard error name         |
| `placeholders` | <pre>unknown[]</pre> | Other arguments, used to fill the placeholders of the error message (rest parameter) |

## Usage

```js
app.errors.register('app', 'api', 'custom', {
  class: 'BadRequestError',
  description: 'This is a custom error from API subdomain',
  message: 'Custom %s error from %s',
});

throw app.errors.get('app', 'api', 'custom', 'Tbilisi', 'Georgia');
```
