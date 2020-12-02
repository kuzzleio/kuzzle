---
code: false
type: page
title: Start Writing a protocol
description: Setup environment for protocol development
order: 100
---

# Start Writing a Protocol

Kuzzle has native support for the following network protocols: [HTTP](/core/2/protocols/native-protocols/http), [MQTT](/core/2/protocols/native-protocols/mqtt) (disabled by default), and [Websocket](/core/2/protocols/native-protocols/websocket).

However, any number of protocols can be implemented, adding new network capabilities.

Protocols are entirely responsible of the network communication layer, which can be as simple as a UDP socket, all the way to a complete pub/sub message broker.
Protocols can even decide to propose a dedicated message format and/or query syntax for the Kuzzle API.

Protocols are provided with objects to interact with Kuzzle:

- [EntryPoint](/core/2/protocols/api/entrypoint): base communication layer (declare user connections, forward API requests, ...)
- [context](/core/2/guides/write-protocols/2-context): utilities and object constructors not directly related to network communications

---

## Prerequisites

### Location

Protocols are subdirectories that must be put at the following location: `<kuzzle_install_dir>/protocols/enabled`.

The recommended way to install a protocol is to put it in `protocols/available`, and to create a symbolic link pointing to it in the `protocols/enabled` directory.

### Node.js modules

Kuzzle loads protocols as [Node.js modules](https://nodejs.org/dist/latest-v8.x/docs/api/modules.html).

This means that a protocol directory must contain either:

- an `index.js` file

and/or:

- a valid [package.json](https://docs.npmjs.com/files/package.json) file. If the protocol's entrypoint is not the root `index.js` file, then the [main](https://docs.npmjs.com/files/package.json#main) property must be filled

### manifest.json

Kuzzle needs a few information to make your protocol work properly. These information must be provided in a `manifest.json` file, in the protocol directory.

The following properties can be defined in this `manifest.json` file:

- `name` (**required**): protocol unique identifier. This protocol name will be used by Kuzzle for statistics, logs, and to provide context to requests
- `kuzzleVersion`: a non-empty string describing a [semver range](https://www.npmjs.com/package/semver#ranges), limiting the range of Kuzzle versions supported by this protocol. If not set, a warning is displayed on the console, and Kuzzle assumes that the protocol is only compatible with Kuzzle v2.x

---

## Interface

To add new network capabilities, a protocol must implement a set of functions, to be called by Kuzzle:

- [broadcast](/core/2/protocols/api/methods/broadcast)
- [disconnect](/core/2/protocols/api/methods/disconnect)
- [init](/core/2/protocols/api/methods/init)
- [joinChannel](/core/2/protocols/api/methods/joinchannel)
- [leaveChannel](/core/2/protocols/api/methods/leavechannel)
- [notify](/core/2/protocols/api/methods/notify)

If one or multiple of these functions are missing, Kuzzle fails to load the protocol, and refuses to start.

---

## Channels

`channel` is a recurrent concept in the protocol interface, one that must be implemented by the protocol itself.

Simply put: it is the same `channel` identifier returned to a user after a [real-time subscription](/core/2/api/controllers/realtime/subscribe). Many users can share the same channel, as it is calculated from the provided subscription filters, after they are normalized (i.e. equivalent yet differently written filters still share the same identifier).

Kuzzle notifies protocols when one of their managed connection [joins](/core/2/protocols/api/methods/joinchannel) or [leaves](/core/2/protocols/api/methods/leavechannel) a channel.

Kuzzle has no opinion on how a protocol handles channels and their associated users. It simply asks protocols to [broadcast](/core/2/protocols/api/methods/broadcast), or to [notify](/core/2/protocols/api/methods/notify) messages to listening users.

---

## Configuration

Protocols can be configured in the Kuzzle [configuration](/core/2/guides/advanced/8-configuration) file, under the `server/protocols/<protocol name>` section.

### Example

```json
{
  "server": {
    "protocols": {
      "mqtt": {
        "port": 1883,
        "allowPubSub": true
      }
    }
  }
}
```

The custom configuration can be found in the EntryPoint object provided to the `init` function, under the following property: `entryPoint.config.protocols.<protocol name>`

---

## Protocol example

```js
module.exports = class MyProtocol {
  constructor () {
    this.context = null;
    this.entryPoint = null;
    this.name = 'foobar';

    // Example on how to maintain client connections
    this.clients = {};
    this.connections = {};
  }

  /**
  * @param {EntryPoint} entryPoint - main protocol interface with Kuzzle
  * @param {object} context - Constructors and utilities
  */
  init (entryPoint, context) {
    // plugin initialization
    this.entryPoint = entryPoint;
    this.context = context;

    // user configuration can be retrieved from entryPoint.config[protocol name]
    this.config = Object.assign({
      default: 'value'
    }, entryPoint.config[this.name] || {});
  }

  /*
   This function is only an example showing how to interact with
   clients and with Kuzzle. It does not implement any actual protocol.

   The way a protocol plugins handles clients closely depends on the
   implemented protocol.
   */
  handleClient () {
    // when a client connects
    this.on('onClientConnect', client => {
      const connection = new this.context.ClientConnection(
        this.name,
        [client.connection.stream.remoteAddress],
        {some: 'header'}
      );

      this.entryPoint.newConnection(connection);
      this.clients[connection.id] = client;
      this.connections[client.id] = connection;
    });

    // when a client sends a request
    this.on('onClientRequest', (client, data) => {
      // Instantiates a Request object to be passed to Kuzzle
      const
        connection = this.connections[client.id],
        request = new this.context.Request(data, { connection });

      this.entryPoint.execute(request, response => {
        // forward the response to the client
      });
    });

    // whenever a client is disconnected
    this.on('onClientDisconnect', client => {
      const connection = this.connections[client.id];
      this.entryPoint.removeConnection(connection.id);
      delete this.clients[connection.id];
      delete this.connections[client.id];
    });
  }

  /*
   Invoked by Kuzzle when a "data.payload" payload needs to be
   broadcasted
  */
  broadcast (channels, payload) {
    for (const channel of channels) {
      // send the payload to all connections having subscribed
      // to that channel
    }
  }

  /*
   Invoked by Kuzzle when a payload needs to be sent to
   a single connection
  */
  notify (channels, connectionId, payload) {
    for (const channel of channels) {
      // send the payload to the connection
    });
  }

  /*
    Invoked by Kuzzle when a connection has subscribed to a channel
   */
  joinChannel (channel, connectionId) {
     // ...
  }

  /*
    Invoked by Kuzzle when a connection leaves a channel
   */
  leaveChannel (channel, connectionId) {
    // ...
  }

  /*
    Invoked by Kuzzle when it needs to force-close a client connection
   */
  disconnect (connectionId) {
    const client = this.clients[connectionId];
    // close the client connection
  }
}
```


## Configuration

When Kuzzle calls the plugin `init` method, it passes the plugin's custom configuration to it.

Custom configuration parameters are specified for each plugin in the `plugins` object of the Kuzzle [configuration](/core/2/guides/advanced/8-configuration).

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

## Plugin loaded from the filesystem

<DeprecatedBadge version="change-me">

Plugins are subdirectories that must be put at the following location: `<kuzzle_install_dir>/plugins/enabled`.

The recommended way to install a plugin is to put it in `plugins/available`, and then link it to the `plugins/enabled` directory.

### Node.js modules

Kuzzle loads plugins as [Node.js modules](https://nodejs.org/dist/latest-v8.x/docs/api/modules.html).

This means that a plugin directory must contain either:

- an `index.js` file

and/or:

- a valid [package.json](https://docs.npmjs.com/files/package.json) file. If the plugin's entrypoint is not the root `index.js` file, then the [main](https://docs.npmjs.com/files/package.json#main) property must be filled

### manifest.json

Kuzzle needs a few information to make your plugin work properly. These information must be provided in a `manifest.json` file, in the plugin directory.

The following properties can be defined in this `manifest.json` file:

- `name` (**required**): plugin unique identifier. Names can only contain letters, numbers, hyphens and underscores.
- `kuzzleVersion`: a non-empty string describing a [semver range](https://www.npmjs.com/package/semver#ranges), limiting the range of Kuzzle versions supported by this plugin. If not set, a warning is displayed on the console, and Kuzzle assumes that the plugin is only compatible with Kuzzle v2.x

</DeprecatedBadge>
