---
code: true
type: page
title: getFrom | Framework | Core

description: BackendErrors getFrom method
---

# getFrom

<SinceBadge version="2.17.1" />

Get a standardized KuzzleError from an existing error to keep the stacktrace

## Arguments

```js
getFrom (source: Error, domain: string, subDomain: string, name: string, ...placeholders: unknown[]): KuzzleError
```

| Argument       | Type              | Description                 |
| -------------- | ----------------- | --------------------------- |
| `source`       | <pre>Error</pre>  | Original error              |
| `domain`       | <pre>string</pre> | Domain name                 |
| `subDomain`    | <pre>string</pre> | Subdomain name              |
| `name`         | <pre>string</pre> | Standard error name         |
| `placeholders` | <pre>unknown[]</pre> | Other arguments, used to fill the placeholders of the error message (rest parameter) |
