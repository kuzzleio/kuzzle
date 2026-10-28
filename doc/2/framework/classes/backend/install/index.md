---
code: true
type: page
title: install | Framework | Core

description: Backend class install() method
---

# Install

<SinceBadge version="2.12.0" />

Register code executed when the application starts, and only once on any given environment. Once successfully executed, the code associated to an install identifier will never be run again on that environment.

::: info
This method can only be used before the application is started.
If the handler throws, the application won't start.
:::

```ts
install (id: string, handler: () => Promise<void>, description?: string): void
```

<br/>

| Argument      | Type                             | Description                                     |
| ------------- | -------------------------------- | ----------------------------------------------- |
| `id`          | <pre>string</pre>                | Unique identifier of this installation          |
| `handler`     | <pre>() => Promise&lt;void&gt;</pre> | Function to execute only once                   |
| `description` | <pre>string</pre>                | Optional description of the installation        |

## Behavior

When the application starts, Kuzzle runs the registered installations in order:

- each installation `id` is recorded in the private `installations` collection of the `kuzzle` index once its handler succeeded; an installation whose `id` is already recorded is skipped,
- installations run under a cluster-wide lock: only one node runs them at a time, and the other nodes wait (with no time limit) until it is done, then skip what is already recorded,
- if a handler throws or rejects, the error is wrapped in a [plugin.runtime.unexpected_installation_error](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime) error and the application does not start.

## Errors

- [plugin.runtime.already_started](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): the application is already started
- [validation.assert.invalid_type](/core/2/api/errors/error-codes/validation#subdomain-0x0501-assert): `id` is not a string, or `handler` is not a function

## Usage

```js
app.install('mappings-2.4.3', async () => {
  await app.sdk.collection.updateMapping('nyc-open-data', 'yellow-taxi', {
    properties: { city: { type: 'keyword' } },
  });
}, 'Add the city field to the yellow-taxi mappings');
```
