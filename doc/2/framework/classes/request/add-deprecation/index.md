---
code: true
type: page
title: addDeprecation
description: Request class addDeprecation() method
---

# addDeprecation

Adds a deprecation notice for a used component, this can be action/controller/parameters...

### Arguments

```ts
addDeprecation(version: string, message: string): void;
```

<br/>

| Arguments    | Type              | Description                                                                       |
| ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `version` | <pre>string</pre> | Version where the used component has been deprecated     |
| `message` | <pre>string</pre> | Warning message     |

### Example

```js
request.addDeprecation('2.4.2', 'Mappings should be passed in the "mappings" property and not directly in the body.');
```
