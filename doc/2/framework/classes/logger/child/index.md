---
code: true
type: page
title: child | Framework | Core
description: Logger.child method
---

# `child()`

Creates a child logger. Its namespace is appended to the parent's one (`kuzzle:app:<namespace>` for a child of `app.log`).

The child writes to the same transports as its parent and follows the parent's level until its own [level](/core/2/framework/classes/logger/properties#level) is set.

```ts
child(namespace: string): Logger
```

<br/>

| Argument    | Type              | Description                |
|-------------|-------------------|----------------------------|
| `namespace` | <pre>string</pre> | Namespace of the child logger |

## Return

A child [Logger](/core/2/framework/classes/logger), with every method of its parent, `getLevel`, `setLevel`, `silly` and `verbose` included.

::: info
Before 2.60.0, a child lacked `getLevel`, `setLevel`, `silly` and `verbose`, although it was declared as a `Logger`.
:::

## Usage

```js
const mailerLog = app.log.child('mailer');

mailerLog.info('Mail sent'); // namespace: "kuzzle:app:mailer"
```
