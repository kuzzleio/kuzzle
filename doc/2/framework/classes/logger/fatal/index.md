---
code: true
type: page
title: fatal | Framework | Core
description: Logger.fatal method
---

# `fatal()`

Logs a message with the `fatal` level.

```ts
fatal(message: string, ...args: any[]): void
fatal(object: object, message?: string, ...args: any[]): void
```

<br/>

| Argument  | Type              | Description |
|-----------|-------------------|-------------|
| `message` | <pre>string</pre> | Message to log. Extra `args` are interpolated into it with [pino placeholders](https://getpino.io/#/docs/api?id=logging-method-parameters) (`%s`, `%d`, `%o`) |
| `object`  | <pre>object</pre> | Properties added to the log line. An `Error` is logged under the `err` key, and its message is used when `message` is omitted |

## Usage

```js
app.log.fatal('Something is happening');

app.log.fatal({ userId: 'aschen' }, 'User %s logged in', 'aschen');
```
