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

A child logger with the [trace](/core/2/framework/classes/logger/trace), [debug](/core/2/framework/classes/logger/debug), [info](/core/2/framework/classes/logger/info), [warn](/core/2/framework/classes/logger/warn), [error](/core/2/framework/classes/logger/error), [fatal](/core/2/framework/classes/logger/fatal), [flush](/core/2/framework/classes/logger/flush) and `child` methods and the [level](/core/2/framework/classes/logger/properties#level) property.

::: warning
Although the declared return type is `Logger`, a child does not have the `getLevel`, `setLevel`, `silly` and `verbose` methods. Use its `level` property instead.
:::

## Usage

```js
const mailerLog = app.log.child('mailer');

mailerLog.info('Mail sent'); // namespace: "kuzzle:app:mailer"
```
