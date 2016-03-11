# Managing Kuzzle service

The Kuzzle service is launched by [kuzzle](kuzzle) command line.


```
$ kuzzle install
```

will install plugins declared in `config/defaultPlugins.json` and in `config/customPlugins.json`

```
$ kuzzle start
```

will launch internally [./commands/kuzzle-start.js](./commands/kuzzle-start.js)

For features like watch mode, multi-thread support from [pm2](https://www.npmjs.com/package/pm2), you can use [app-start.js](../app-start.js)

# Enable/Disable services

You can enable services in a running Kuzzle without restarting it with a simple command line:

```
$ kuzzle enable <service> <PID|all>
```

Where:

* service is the Kuzzle service name you want to activate (for instance: mqBroker)
* PID is the processus ID of the Kuzzle server or worker you want to control. Use 'all' if you want to broadcast a service activation to a Kuzzle server and all its workers.

You can disable a service with:

```
$ kuzzle disable <service> <PID|all>
```

**Note:** All services containing a toggle() method can be activated or deactivated on the fly. Some vital services can't be togglable. 

# Create the first admin

You will need it to connect to the back-office

```
$ kuzzle createFirstAdmin
```

will guide you through the creation process of the first admin user and fix the rights to other user types if needed.

**Note:** This command is interractive and let you choose to reset the roles rights or not.

# Reset Kuzzle

```
$ kuzzle likeAvirgin
```

will allow you to reset Kuzzle and restore it as if it is freshly installed.

If you need to be connected as an administrative user, an interrective prompt will ask you for a username and a password

## Reset and add fixtures or mappings

You can perform a reset followed by a fixtures and/or mappings import by doing:

```
$ kuzzle likeAvirgin --fixtures /path/to/the/fixtures/file.json --mappings /path/to/the/mappings/file.json
```

# Contributing

As an example, to implement your custom "kuzzle stop" action:

* create kuzzle-stop.js,
* modify kuzzle accordingly.
