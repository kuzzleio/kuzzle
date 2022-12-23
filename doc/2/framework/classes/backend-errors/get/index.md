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
get (domain: string, subDomain: string, name: string, placeholders: any[]): KuzzleError
```

| Argument       | Type              | Description                 |
| -------------- | ----------------- | --------------------------- |
| `domain`       | <pre>string</pre> | Domain name                 |
| `subDomain`    | <pre>string</pre> | Subdomain name              |
| `name`         | <pre>string</pre> | Standard error name         |
| `placeholders` | <pre>any[]</pre>  | Other placeholder arguments |

