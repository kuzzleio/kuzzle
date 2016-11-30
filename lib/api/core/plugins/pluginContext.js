var
  _ = require('lodash'),
  Promise = require('bluebird'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  RequestInput = require('kuzzle-common-objects').models.RequestInput;

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
    Request,
    RequestContext,
    RequestInput,
    BaseValidationType: require('../validation/baseType')
  };
  this.errors = {};

  _.forOwn(require('kuzzle-common-objects').errors, (constructor, name) => {
    this.errors[_.upperFirst(name)] = constructor;
  });

  if (kuzzle instanceof Kuzzle) {
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
 * @param {Request} request
 * @param {function} callback
 */
function execute (request, callback) {
  var kuzzle = this;
  // TODO align on funnel usage
  processRequest(kuzzle, request)
    .then(
      response => {
        response.setResult(response);
        callback(null, request);
      }
    )
    .catch(err => {
      kuzzle.pluginsManager.trigger('log:error', err);
      request.setError(err);

      callback(err, request);

      kuzzle.funnel.handleErrorDump(err);

      return null;
    });
}

/**
 * Execute the request immediately
 *
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @returns {Promise<*>}
 */
function processRequest(kuzzle, request) {
  var controllers = kuzzle.funnel.controllers;

  if (
    !controllers[request.input.controller]
    || !controllers[request.input.controller][request.input.action]
    || typeof controllers[request.input.controller][request.input.action] !== 'function'
  ) {
    return Promise.reject(new BadRequestError('No corresponding action ' + request.input.action + ' in controller ' + request.input.controller));
  }

  return controllers[request.input.controller][request.input.action](request);
}

/**
 * UserRepositories wrapper to expose user creation to plugins.
 * If "userInfo" does not contain a profile attribute, this function
 * will add one with the value "default"
 *
 * @param {object} userRepository - Kuzzle's user repositories
 * @param {string} name - user name
 * @param {string} [profile] - profile name
 * @param {object} [userInfo] - the user to be created
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
