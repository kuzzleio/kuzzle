#Managing Kuzzle service

The service Kuzzle is launched by [kuzzle.js](kuzzle.js) command line.

     $ kuzzle.js start 

will launch internally [kuzzle-start.js](kuzzle-start.js)

For features like watch mode, multi-thread support from [pm2](https://www.npmjs.com/package/pm2), you can use [app-start](../app-start.js)

#contribute

As an example, for implementing your custom "kuzzle.js stop" action:
* create kuzzle-stop.js,
* modify kuzzle.js accordingly.