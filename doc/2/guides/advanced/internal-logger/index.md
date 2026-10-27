---
code: false
type: page
order: 500
title: Internal Logger | Kuzzle Advanced | Guide | Core
meta:
  - name: description
    content: Internal Logger usage and configuration
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, opensource, Internal Logger
---

# Internal Logger

Kuzzle uses its own opinionated wrapper around [Pino](https://getpino.io) to log messages.

The internal logger has 6 priority levels:

- trace _(not printed by default)_
- debug _(not printed by default)_
- info
- warn
- error
- fatal

::: info
Pino can send the logs to different "transports" like stdout, a file, Loki or Elasticsearch.
By default, the **logs are printed to stdout**.
:::

## Usage in an Application

<SinceBadge version="2.8.0" />

The application logger is available as [app.log](/core/2/framework/classes/backend/properties) as soon as the `Backend` instance is created.

Each method takes either a message, or an object followed by an optional message. When the object is an `Error`, it is logged under the `err` key (with its name, message, stack and, for Kuzzle errors, id and code) and its message is used if you give none.

By default the log level is `info`. You can change it with the `server.appLogs.level` configuration key, in a [.kuzzlerc file or an environment variable](/core/2/guides/advanced/configuration) (e.g. `kuzzle_server__appLogs__level=debug`).

::: warning
The logger is configured when the `Backend` instance is created: changing `server.appLogs` with `app.config` afterwards has no effect. Use `app.log.setLevel()` to change the level at runtime.
:::

**Example:** _Log messages and change the log level at runtime_

```js
import { Backend } from "kuzzle";

const app = new Backend("black-mesa");

app.start().then(() => {
  app.log.debug("debug"); // not printed with the default "info" level
  app.log.info("info");
  app.log.warn({ userId: "gordon" }, "suspicious activity");

  try {
    throw new Error("resonance cascade");
  } catch (error) {
    app.log.error(error); // logged under the "err" key
  }

  app.log.setLevel("trace"); // change the log level at runtime
  app.log.trace("trace"); // printed this time
});
```

::: info
The `silly` and `verbose` methods still work but are deprecated: they log at the `trace` and `debug` levels.
:::

## Configure the Logger

The logger is configured in the `server.appLogs` section of the [configuration](/core/2/guides/advanced/configuration):

- `level`: the minimum level to log (default: `info`),
- `transport`: where the logs are sent, as a list of `targets`. Each target either uses a preset, or is a raw [pino transport](https://getpino.io/#/docs/transports) configuration.

The available presets are:

| Preset | Output |
|---|---|
| `stdout` | The standard output (default): human-readable when `NODE_ENV` is `development` (or unset), JSON lines otherwise |
| `file` | A file, set with `presetOptions.destination` |
| `loki` | A [Grafana Loki](https://grafana.com/oss/loki/) server, set with `presetOptions.host` |
| `kuzzle-elasticsearch` | An Elasticsearch index, in the [ECS](https://www.elastic.co/guide/en/ecs/current/index.html) format, set with `presetOptions.node` |

**Example:** _Print the logs to stdout and send them to Loki_

```json
{
  "server": {
    "appLogs": {
      "level": "info",
      "transport": {
        "targets": [
          { "preset": "stdout" },
          {
            "preset": "loki",
            "presetOptions": { "host": "http://loki:3100" }
          }
        ]
      }
    }
  }
}
```

The options of each preset are described in the [Kuzzle Logger documentation](https://docs.kuzzle.io/modules/logger/1/guides/transport-configuration/).
