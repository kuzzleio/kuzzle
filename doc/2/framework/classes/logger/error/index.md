---
code: true
type: page
title: error | Framework | Core
description: Logger.error method
---

# `error()`

Logs a message with the `error` level.

```ts
error(message: string, ...args: any[]): void
error(object: object, message?: string, ...args: any[]): void
```

<br/>

| Argument  | Type              | Description |
|-----------|-------------------|-------------|
| `message` | <pre>string</pre> | Message to log. Extra `args` are interpolated into it with [pino placeholders](https://getpino.io/#/docs/api?id=logging-method-parameters) (`%s`, `%d`, `%o`) |
| `object`  | <pre>object</pre> | Properties added to the log line. An `Error` is logged under the `err` key, and its message is used when `message` is omitted |

## Usage

```js
app.log.error('Something is happening');

app.log.error({ userId: 'aschen' }, 'User %s logged in', 'aschen');
```
