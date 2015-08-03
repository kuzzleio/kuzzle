# Managing Kuzzle service

The Kuzzle service is launched by [kuzzle.js](kuzzle.js) command line.

     $ kuzzle.js start 

will launch internally [kuzzle-start.js](kuzzle-start.js)

For features like watch mode, multi-thread support from [pm2](https://www.npmjs.com/package/pm2), you can use [app-start.js](../app-start.js)

# Contributing

As an example, to implement your custom "kuzzle.js stop" action:

* create kuzzle-stop.js,
* modify kuzzle.js accordingly.