---
code: true
type: page
title: getFrom
description: BackendErrors getFrom method
---

# getFrom

<SinceBadge version="auto-version" />

Get a standardized KuzzleError from an existing error to keep the stacktrace

## Arguments

```js
getFrom (source: Error, subDomain: string, name: string, placeholders: any[]): KuzzleError
```

| Argument | Type | Description |
|----------|------|-------------|
| `source` | <pre>Error</pre> | Original error |
| `subDomain` | <pre>string</pre> | Subdomain name |
| `name` | <pre>string</pre> | Standard error name |
| `placeholders` | <pre>any[]</pre> | Other placeholder arguments |

