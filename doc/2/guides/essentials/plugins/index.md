---
code: false
type: page
title: Kuzzle's Plugin Engine
order: 1100
---

# Kuzzle's Plugin Engine

Our prepackaged multi-feature backend solution will meet basic project requirements, but in some cases you may want to **implement your own business logic**.

For example, imagine you are developing a mobile application that accesses a **third-party payment platform**, such as Braintree, through its third-party's API. For **security** reasons, you will want to avoid accessing the third-party's API directly from the mobile device. Also, you will not want users to purchase more items than are currently in stock, so your backend will need to **monitor** what has been purchased. To achieve all this, you will want to develop a custom Plugin that lets Kuzzle communicate directly with the third-party payment platform.

Kuzzle's **[Plugin Engine](/core/2/plugins)** is a powerful feature that ensures that Kuzzle meets any project requirement:

- select from a set of prebuilt plugins (such as the [OAuth2 Authentication Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-oauth) or the [Cluster Plugin](https://github.com/kuzzleio/kuzzle-plugin-cluster)).
- [create your own plugin](/core/2/guides/essentials/introduction) to meet your specific requirements.

---

## Plugins

Plugins are used to extend Kuzzle's functionalities. They are loaded into Kuzzle during startup and share its execution thread. A plugin can implement one or multiple of the following interfaces:

[Hooks](/core/2/plugins/guides/hooks): adds asynchronous listeners that perform operations triggered by data events. When a listened event occurs, the data is sent to the listeners and Kuzzle continues its process without waiting for the listener to complete.

_Example - "Write a log to a third-party logging service every time a document is deleted"_. The [Logger Plugin](https://github.com/kuzzleio/kuzzle-plugin-logger) (shipped with Kuzzle) uses this feature to log all the data-related events.

[Pipes](/core/2/plugins/guides/pipes): adds synchronous listeners that perform operations triggered by data events. When a listened event occurs, the data is passed synchronously to listeners, each modifying the input data and returning the result to the next listener. Kuzzle waits until the last listener completes and returns its data. If any listener returns an error, it will interrupt the Kuzzle lifecycle, and the thrown error will be used as a response by Kuzzle.

_Example - "Compare the ordered quantity with the available stock and return an error if the amount of ordered items exceeds the amount in stock"_.

[Controllers](/core/2/plugins/guides/controllers): extends Kuzzle API.

_Example - "Expose a `checkout` API endpoint that handles a third-party payment process"_.

[Strategies](/core/2/plugins/guides/strategies): add an authentication strategy to identify and authenticate users.

_Example - "Enable OAuth based authentication in Kuzzle"_
Kuzzle ships with the [Local Strategy Plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local) and thanks to PassportJS, more than 300 authentication strategies are readily available.

## Protocols

[Protocols](/core/2/protocols/essentials/getting-started) add extended networking capabilities to your Kuzzle installation. These are useful if you need to handle other, even proprietary transport protocols.

---

## Installing a Plugin

:::info
If you are running Kuzzle in a Docker container, you will need to access the running container's shell and then the Kuzzle installation folder inside the container.
:::

To install a plugin, you need to make it accessible in the `plugins/enabled` folder of your Kuzzle installation.

A common practice is to first copy the plugin to a `plugins/available` folder, and then creating a symbolic link from that folder to the `plugins/enabled` folder. This way, you can easily enable and disable a plugin just by creating or deleting a symbolic link, respectively.

:::info
<SinceBadge version="1.10.0" />

If you are running Kuzzle in a Docker container, you can use the `$KUZZLE_PLUGINS` environment variable to enable plugins located in `plugins/available` folder.
The variable will be used as argument for the `--enable-plugins` options from the [Kuzzle CLI start command](/core/2/guides/essentials/cli).
:::

Prior to loading the plugin into Kuzzle, you will need to load all of the plugin dependencies by running `npm install` from within the plugin folder.

To demonstrate, we are going to install the [**Plugin Boilerplate**](https://github.com/kuzzleio/kuzzle-core-plugin-boilerplate), a plugin example that uses all features available to a plugin.

Go to the Kuzzle installation folder and type:

```bash
# Open plugins/available folder
cd <kuzzle directory>/plugins/available

# Download Plugin to plugins/available folder
git clone https://github.com/kuzzleio/kuzzle-core-plugin-boilerplate.git

# Install the Plugin dependencies
cd kuzzle-core-plugin-boilerplate
npm install # add --unsafe-perm if installing from inside a docker container

# Enable the installed plugin. Delete this link to disable it
cd ../../enabled
ln -s ../available/kuzzle-core-plugin-boilerplate

# Restart Kuzzle to reload plugins
```

---

Once Kuzzle has restarted, check the server information at `http://localhost:7512/?pretty=true` to confirm that the plugin has been installed. You should now see the `kuzzle-core-plugin-boilerplate` Plugin entry:

```json
{
  "...": "...",

  "result": {
    "serverInfo": {
      "kuzzle": {
        "plugins": {
          "kuzzle-core-plugin-boilerplate": {
            "name": "kuzzle-core-plugin-boilerplate",
            "hooks": [
              "document:beforeCreateOrReplace",
              "document:beforeReplace",
              "document:beforeUpdate",
              "core:overload"
            ],
            "pipes": ["document:beforeCreate", "realtime:beforePublish"],
            "controllers": ["kuzzle-core-plugin-boilerplate/myNewController"],
            "routes": [
              {
                "verb": "get",
                "url": "/kuzzle-core-plugin-boilerplate/say-something/:property",
                "controller": "kuzzle-core-plugin-boilerplate/myNewController",
                "action": "myNewAction"
              },
              {
                "verb": "post",
                "url": "/kuzzle-core-plugin-boilerplate/say-something",
                "controller": "kuzzle-core-plugin-boilerplate/myNewController",
                "action": "myNewAction"
              }
            ],
            "strategies": ["dummy"]
          }
        }
      }
    }
  }
}
```

Note that the plugin description above contains a property for each plugin component:

- `hooks` asynchronous operations that depend on data-related events
- `pipes` synchronous operations that depend on data-related events
- `controllers` list of exposed actions in the API
- `routes` list of exposed actions in the **REST** API
- `strategies` list of exposed authentication strategies

---

## Installing protocols

The steps to install a new protocol are exactly the same than for plugins, except that you have to use the `protocols/` directory, instead of the `plugins/` one.

To install a protocol:

```bash
# In Kuzzle's directory:
cd protocols/available

# copy the protocol folder into the current directory
cp -r <protocol_dir> .

# Install the protocol's dependencies
cd <protocol_dir>
npm install # add --unsafe-perm if installing from inside a docker container

# Enable the installed plugin. Delete this link to disable it
cd ../../enabled
ln -s ../available/<protocol_dir>

# Restart Kuzzle to reload protocols
```
