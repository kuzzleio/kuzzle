---
code: false
type: page
order: 100
title: Configuration | Kuzzle Advanced | Guide | Core
meta:
  - name: description
    content: Configure Kuzzle
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, opensource,  Configuration
---

# Configuring Kuzzle

The Kuzzle **configuration** is stored in a [kuzzlerc file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc) found in the root folder of your Kuzzle installation.

Kuzzle uses [rc](https://github.com/dominictarr/rc) to **override** its default configuration by either:

- loading parameters from a `.kuzzlerc` file ([sample file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc)) ;
- loading parameters from environment variables with a `kuzzle_` prefix.

## Use .kuzzlerc file

You can write your custom config parameters in a `.kuzzlerc` and store it in `$HOME/.kuzzlerc` or [one of these locations](https://github.com/dominictarr/rc/blob/master/README.md#standards):

```json
{
  "services": {
    "storageEngine": {
      "client": {
        "host": "http://localhost:9200"
      }
    }
  }
}
```

## Use Environment Variables

The name of the environment variable must match the path of the configuration parameter in the `.kuzzlerc` file. To set the name of the environment variable:

- Use the prefix `kuzzle_`,
- then append the parameter path (as defined in the `.kuzzlerc` file) by using a **double underscore** `__` to separate each level of its hierarchy.

For example, the `.kuzzlerc` parameter `services.storageEngine.host` in example 1, is represented by the environment variable `kuzzle_services__storageEngine__host`:

```bash
export kuzzle_services__storageEngine__host="http://localhost:9200"
```

You can also pass stringified JSON values this way to override non-scalar values such as objects or arrays.
To do so, prefix a valid stringified JSON with `*json:` to instruct Kuzzle to parse the content of the value as JSON.

Examples:

```bash
export kuzzle_security__restrictedProfileIds='*json:["default","foo","bar"]'
export kuzzle_services__common='*json:{"defaultInitTimeout":120000, "retryInterval":1000}'
```

### Docker Compose

Environment variables are particularly handy when running Kuzzle in a **Docker** container. Using **Docker Compose**, they can easily be configured in the `environment` section of the `docker-compose.yml` file. For example, here's how we pass environment variables to Kuzzle in our default docker-compose file:

```yaml
version: "3"

services:
  kuzzle:
    image: kuzzleio/kuzzle:2
    cap_add:
      - SYS_PTRACE
    depends_on:
      - redis
      - elasticsearch
    environment:
      - kuzzle_services__storageEngine__client__node=http://elasticsearch:9200
      - kuzzle_services__internalCache__node__host=redis
      - kuzzle_services__memoryStorage__node__host=redis
      - NODE_ENV=production

  redis:
    image: redis:6

  elasticsearch:
    image: kuzzleio/elasticsearch:7
    ulimits:
      nofile: 65536
```

:::info
For an exhaustive list of configuration parameters, please refer to the [kuzzlerc sample file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc).
:::

## Use Backend.config property

<SinceBadge version="2.8.0" />

::: info
You can change the configuration only during the `setup` phase, before starting the application.
:::

The configuration of Kuzzle is also accessible through the [Backend.config](/core/2/framework/classes/backend-config) property.

It is possible to **read or edit values of the configuration**.

The set of keys that can be configured is available in the file [.kuzzlerc.sample.jsonc](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc)

::: info
See the [Configuration](/core/2/guides/advanced/configuration) guide for more information on how to configure Kuzzle.
:::

**Example:** _Change configuration values_

```js
// Read a configuration value
console.log(`Kuzzle will listen on port ${app.config.content.server.port}`);

// Set log level to debug
app.config.content.server.appLogs.level = "debug";

// Listen to port 4242
app.config.content.server.port = 4242;
```
