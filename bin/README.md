# Managing Kuzzle service

The Kuzzle service is launched by [kuzzle.js](kuzzle.js) command line.

     $ kuzzle.js start 

will launch internally [kuzzle-start.js](kuzzle-start.js)

For features like watch mode, multi-thread support from [pm2](https://www.npmjs.com/package/pm2), you can use [app-start.js](../app-start.js)

# Enable/Disable services

You can enable services in a running Kuzzle without restarting it with a simple command line:

```
$ kuzzle enable profiling
```

And you can disable a service with:

```
$ kuzzle disable profiling
```

# Contributing

As an example, to implement your custom "kuzzle.js stop" action:

* create kuzzle-stop.js,
* modify kuzzle.js accordingly.