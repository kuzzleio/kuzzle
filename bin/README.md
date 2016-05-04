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
$ kuzzle enable <service> --pid <PID|all>
```

Where:

* service is the Kuzzle service name you want to activate (for instance: mqBroker)
* PID is the processus ID of the Kuzzle server or worker you want to control. Use 'all' if you want to broadcast a service activation to a Kuzzle server and all its workers.

You can disable a service with:

```
$ kuzzle disable <service> --pid <PID|all>
```

**Note:** All services containing a toggle() method can be activated or deactivated on the fly. Some vital services can't be togglable. 

# Create the first administrative user account

You will need it to connect to the back-office

```
$ kuzzle createFirstAdmin
```

will guide you through the creation process of the first admin user and fix the rights to other user types if needed.

# Reset Kuzzle

```
$ kuzzle likeAvirgin --pid <PID|all>
```

will allow you to reset Kuzzle and restore it as if it is freshly installed.


## Reset and add fixtures or mappings

You can perform a reset followed by a fixtures and/or mappings import by doing:

```
$ kuzzle likeAvirgin --fixtures /path/to/the/fixtures/file.json --mappings /path/to/the/mappings/file.json
```

# Getting help

You can, of course, get some help by using the --help option. 

Try those: 

```
$ kuzzle --help
$ kuzzle start --help
$ kuzzle likeAvirgin --help
```
**Note:** This command is interactive and let you choose to reset the roles rights or not.

# Contributing

As an example, to implement your custom "kuzzle stop" action:

* create kuzzle-stop.js,
* modify kuzzle accordingly.
