---
code: false
type: page
title: Configuration
description: how to create a custom plugin
order: 1
---

# Configuration

When Kuzzle calls the plugin `init` method, it passes the plugin's custom configuration to it.

Custom configuration parameters are specified for each plugin in the `plugins` object of the Kuzzle [configuration file](/core/2/guides/essentials/configuration).

For example:

```json
{
  "plugins": {
    "foobar-plugin": {
      "option_1": "option_value",
      "option_2": "option_value"
    }
  }
}
```
