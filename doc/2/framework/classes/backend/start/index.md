---
code: true
type: page
title: start
description: Backend class start() method
---

# start

This method starts the application.

Once the promise returned by this method resolved, the application is in the `running` phase.

```ts
start(): Promise<void>
```

<br/>

## Returns

Returns a Promise resolving when the application is running.

## Usage

```js
try {
  await app.start()
  // Application is now in "running" phase
}
catch (error) {
  console.log(error)
}
```
