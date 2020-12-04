---
code: false
type: page
title: Internal Logger
description: Internal Logger usage and configuration
order: 500
---

# Internal Logger

Kuzzle uses [Winston](https://github.com/winstonjs/winston) to log messages.  

The internal logger has 5 priority levels:
 - debug _(not printed by default)_
 - verbose _(not printed by default)_
 - info
 - warn
 - error

::: info
Winston is able to redirect the logs on differents "services" like stdout, syslog, Elasticsearch etc.  
By default, the **logs are printed to stdout**.
:::

## Usage in an Application

<SinceBadge version="change-me" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

::: info
The Internal Logger is available only during the `runtime` phase, after the application has started.
::: 

Messages will be logged using the [util.inspect](https://nodejs.org/api/util.html#util_util_inspect_object_options) method from Node.js.

By default the log level is set to `info`. You can change this [configuration](/core/2/guides/advanced/configuration) under the `plugins.kuzzle-plugin-logger.services.stdout.level` configuration key.

**Example:** _Set the log level to verbose and log verbose messages_

```js
import { Backend } from 'kuzzle';

const app = new Backend('black-mesa');

// Set log level to verbose
app.config.set(
  'plugins.kuzzle-plugin-logger.services.stdout.level', 
  'verbose')

app.start()
  .then(() => {
    app.log.debug('debug')
    app.log.verbose('verbose')
    app.log.info('info')
    app.log.warn('warn')
  })
```

<!-- 
## Configure Logger

@todo

-->
