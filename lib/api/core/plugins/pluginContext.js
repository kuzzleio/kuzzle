var
  _ = require('lodash'),
  Promise = require('bluebird'),
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function PluginContext(kuzzle) {
  // we have a circular dependency between Kuzzle and the plugins.
  // We cannot get Kuzzle constructor from the global scope
  var Kuzzle = require('../../kuzzle');

  this.accessors = {};
  this.config = kuzzle.config;
  this.constructors = {
    Dsl: require('../../dsl'),
    RequestObject: RequestObject,
    ResponseObject: ResponseObject,
    BaseValidationType: require('../validation/baseType')
  };
  this.errors = {};

  _.forOwn(require('kuzzle-common-objects').Errors, (constructor, name) => {
    this.errors[_.upperFirst(name)] = constructor;
  });

  if (kuzzle instanceof Kuzzle) {
    Object.defineProperty(this, 'log', {
      enumerable: true,
      get: () => (level, msg) => {
        return kuzzle.pluginsManager.trigger('log:' + level, msg);
      }
    });

    Object.defineProperty(this.accessors, 'passport', {
      enumerable: true,
      get: () => {
        return {
          use: kuzzle.passport.use
        };
      }
    });

    Object.defineProperty(this.accessors, 'execute', {
      enumerable: true,
      get: () => {
        return execute.bind(kuzzle);
      }
    });

    /*
     Sharing only a handful user functions as wrappers for the repositories object
     */
    Object.defineProperty(this.accessors, 'users', {
      enumerable: true,
      get: () => {
        return {
          load: userId => kuzzle.repositories.user.load(userId),
          create: (name, profile, info) => createUser(kuzzle.repositories.user, name, profile, info)
        };
      }
    });

    Object.defineProperty(this.accessors, 'validation', {
      enumerable: true,
      get: () => {
        return {
          addType: kuzzle.validation.addType.bind(kuzzle.validation),
          validate: kuzzle.validation.validationPromise.bind(kuzzle.validation)
        };
      }
    });
  }
}

/**
 * @this {Kuzzle}
 * @param {RequestObject} requestObject
 * @param {Object} userContext
 * @param {function} callback
 */
function execute (requestObject, userContext, callback) {
  var kuzzle = this;
  processRequest(kuzzle, requestObject, userContext)
    .then(response => callback(null, response.responseObject))
    .catch(err => {
      kuzzle.pluginsManager.trigger('log:error', err);
      callback(err, new ResponseObject(requestObject, err));

      kuzzle.funnel.handleErrorDump(err);

      return null;
    });
}

/**
 * Execute the request immediately
 *
 * @param {Kuzzle} kuzzle
 * @param {RequestObject} requestObject
 * @param userContext
 */
function processRequest(kuzzle, requestObject, userContext) {
  var controllers = kuzzle.funnel.controllers;

  if (
    !controllers[requestObject.controller]
    || !controllers[requestObject.controller][requestObject.action]
    || typeof controllers[requestObject.controller][requestObject.action] !== 'function'
  ) {
    return Promise.reject(new BadRequestError('No corresponding action ' + requestObject.action + ' in controller ' + requestObject.controller));
  }

  return controllers[requestObject.controller][requestObject.action](requestObject, userContext);
}

/**
 * UserRepositories wrapper to expose user creation to plugins.
 * If "userInfo" does not contain a profile attribute, this function
 * will add one with the value "default"
 *
 * @param {Object} userRepository - Kuzzle's user repositories
 * @param {string} name - user name
 * @param {string} [profile] - profile name
 * @param {Object} [userInfo] - the user to be created
 * @returns {Promise<T>}
 */
function createUser(userRepository, name, profile, userInfo) {
  var
    userConstructor = new userRepository.ObjectConstructor();

  if (!userInfo) {
    if (profile && typeof profile === 'object') {
      userInfo = profile;
      profile = 'default';
    }
    else {
      userInfo = {};
    }
  }

  if (!name || typeof name !== 'string') {
    return Promise.reject(new PluginImplementationError('User creation error: "name" argument invalid or missing'));
  }

  if (typeof userInfo !== 'object' || Array.isArray(userInfo)) {
    return Promise.reject(new PluginImplementationError('User creation error: invalid "info" argument (expected an object)'));
  }

  userInfo._id = name;
  userInfo.profileIds = [ 'default' ];
  if (profile) {
    userInfo.profileIds = Array.isArray(profile) ? profile : [profile];
  }

  return userRepository.hydrate(userConstructor, userInfo)
    .then(user => userRepository.persist(user, {database: {method: 'create'}}))
    /*
     masking the resolved user object to avoid plugin developers having access
     to an internal Kuzzle object
     */
    .then(() => userInfo);
}

module.exports = PluginContext;
