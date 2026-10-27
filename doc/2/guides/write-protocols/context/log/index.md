---
code: true
type: page
title: log | Protocol Framework | Write protocols | Guide
meta:
  - name: description
    content: The context.log object exposes functions used to send messages to Kuzzle's logging system.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, protocol framework, log
---

# log

The `context.log` object exposes functions used to send messages to Kuzzle's logging system.

Log levels are assigned to each exposed log function, corresponding to the log priority.
The lower the log level, the higher its priority.

Messages are sent to Kuzzle's [internal logger](/core/2/guides/advanced/internal-logger): levels below the threshold set by the `server.appLogs.level` key of Kuzzle's [configuration file](/core/2/guides/advanced/configuration) (`info` by default) are ignored.

::: warning
`verbose` and `silly` are deprecated: they log at the `debug` and `trace` levels of the internal logger. Use `debug` instead.
:::

---

## error



### Priority

`0` (highest priority)

### Example

```js
context.log.error('error message');
```

---

## warn



### Priority

`1`

### Example

```js
context.log.warn('warning message');
```

---

## info



### Priority

`2`

### Example

```js
context.log.info('info message');
```

---

## verbose



### Priority

`3` (ignored by default)

### Example

```js
context.log.verbose('verbose message');
```

---

## debug



### Priority

`4` (ignored by default)

### Example

```js
context.log.debug('debug message');
```

---

## silly



### Priority

`5` (lowest priority, usually ignored)

### Example

```js
context.log.silly('silly message');
```
