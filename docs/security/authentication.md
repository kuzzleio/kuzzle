# Kuzzle Authentication

## Overview

Kuzzle uses [passportjs](http://passportjs.org/) to enable authentication with a potentially large amount of providers, for example:
* local username/password authentication (enabled by default)
* oauth2 providers like github or google
* SAML providers
* etc.

## How it works

Kuzzle provides a **auth** controller which delegates the authentication strategy to passportjs.

If the passportjs _authenticate_ method resolves an existing user, Kuzzle generates a [JSON Web Token](https://tools.ietf.org/html/rfc7519) that should be used in subsequent requests.

See also Kuzzle API Documentation about [Auth Controller](http://kuzzleio.github.io/kuzzle-api-documentation/#auth-controller) and [JWT token usage](http://kuzzleio.github.io/kuzzle-api-documentation/#authorization-header) in Kuzzle requests.

## How to provide your own strategy

Any strategy supported by passportjs can be implemented for Kuzzle with a dedicated plugin (see [plugins documentation](../plugins.md)).

Take example in [Passport Local plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local), an authentication plugin must provide following steps:

### The strategy module

This module is a wrapper to the needed passportjs strategy:

```javascript
// lib/passport/strategy.js
var
  q = require('q'),
  MyNewStrategy = require('passport-my-new-strategy').Strategy;

module.exports = function(context){
  (...)
};
```

It implements:

* a __load__ method to activate the strategy:

```javascript
    this.load = function(passport) {
      passport.use(new MyNewStrategy(this.verify));
    };
```

* a __verify__ method that implements the strategy's [verify callback](http://passportjs.org/docs#verify-callback).

This method accepts a variable numbers of arguments, depending on the strategy, and a _done_ callback that should be invoked when authentication succeed.

NB: because passportjs uses the Callback pattern while Kuzzle uses Promises, you must **promisify** the _done_ callback:

```javascript
    this.verify = function(<params>, done) {
      var deferred = q.defer();

        myCustomVerificationMethod(<params>)
        .then(function (userObject) {
          if (userObject !== null) {
            deferred.resolve(userObject);
          }
          else {
            deferred.reject(new context.ForbiddenError('Bad Credentials'));
          }
        })
        .catch(function (err) {
          deferred.reject(err);
        });

      deferred.promise.nodeify(done);
      return deferred.promise;
    };
```

### The hook activation

The authController initialization triggers the "auth:loadStrategies" hook event, that can be used to load plugin's strategy, like that:

* declare the hook mapping:

```javascript
// lib/config/hooks.js
module.exports = {
  'auth:loadStrategies': 'loadStrategy',
};
```

* implement the hook method:

```javascript
// lib/index.js
var
  hooks = require('./config/hooks'),
  Strategy = require('./passport/strategy');

module.exports = function () {

  (...)

  this.hooks = hooks;

  this.loadStrategy = function(passport, event) {
    var strategy = new Strategy(this.context);
    strategy.load(passport);
  };

};
```
