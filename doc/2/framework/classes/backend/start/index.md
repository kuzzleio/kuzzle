---
code: true
type: page
title: start | Framework | Core

description: Backend class start() method
---

# start

<SinceBadge version="2.8.0" />

This method starts the application.

Once the promise returned by this method resolved, the application is in the `running` phase.

```ts
start(): Promise<void>
```

<br/>

## Returns

Returns a Promise resolving when the application is running.

## Errors

- [plugin.runtime.already_started](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): the application is already started
- <SinceBadge version="2.60.0" /> [cluster.join.duplicate_ip, cluster.join.full_state_unavailable or cluster.join.timeout](/core/2/api/errors/error-codes/cluster#subdomain-0x0801-join): the node cannot join the cluster

::: warning
<SinceBadge version="2.60.0" />

A failed startup cannot be retried: the node shuts down and the process exits with code `1`.
The promise still rejects with the error before the process exits, so you can log it.
See [A failed startup stops the node](/core/2/guides/upgrade-notes/from-2-59#a-failed-startup-stops-the-node).
:::

## Usage

```js
try {
  await app.start()
  // Application is now in "running" phase
}
catch (error) {
  // The node is shutting down: log the error, do not try to go on
  app.log.error(error)
}
```
