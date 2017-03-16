'use strict';

const
  _ = require('lodash'),
  Promise = require('bluebird'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
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
  const Kuzzle = require('../../kuzzle');

  this.accessors = {};
  this.config = kuzzle.config;
  this.constructors = {
    Dsl: require('../../dsl'),
    Request: instantiateRequest,
    RequestContext,
    RequestInput,
    BaseValidationType: require('../validation/baseType')
  };
  this.errors = {};

  _.forOwn(require('kuzzle-common-objects').errors, (constructor, name) => {
    this.errors[_.upperFirst(name)] = constructor;
  });

  if (kuzzle instanceof Kuzzle) {
    Object.defineProperty(this, 'log', {
      enumerable: true,
      get: () => {
        return {
          silly: msg => kuzzle.pluginsManager.trigger('log:silly', msg),
          verbose: msg => kuzzle.pluginsManager.trigger('log:verbose', msg),
          info: msg => kuzzle.pluginsManager.trigger('log:info', msg),
          debug: msg => kuzzle.pluginsManager.trigger('log:debug', msg),
          warn: msg => kuzzle.pluginsManager.trigger('log:warn', msg),
          error: msg => kuzzle.pluginsManager.trigger('log:error', msg)
        };
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
 * @param {Request} request
 * @param {function} callback
 */
function execute (request, callback) {
  const kuzzle = this;

  return kuzzle.funnel.processRequest(request)
    .then(response => {
      if (callback) {
        try {
          callback(null, response);
        }
        catch (e) {
          kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError(`Uncatched error by a plugin callback: ${e}`));
        }

        return;
      }

      return Promise.resolve(response);
    })
    .catch(err => {
      request.setError(err);
      kuzzle.funnel.handleErrorDump(err);

      if (callback) {
        try {
          callback(err, request);
        }
        catch (e) {
          kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError(`Uncatched error by a plugin callback: ${e}`));
          kuzzle.pluginsManager.trigger('log:error', `Previous error: ${err}`);
        }
        return;
      }

      return Promise.reject(err);
    });
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

  return userRepository.hydrate(new userRepository.ObjectConstructor(), userInfo)
    .then(user => userRepository.persist(user, {database: {method: 'create'}}))
    /*
     masking the resolved user object to avoid plugin developers having access
     to an internal Kuzzle object
     */
    .then(() => userInfo);
}

/**
 * Instantiates a new Request object, using the provided one
 * to set the context informations
 *
 * @throws
 * @param {Request} request
 * @param {Object} data
 * @param {Object} [options]
 * @return {Request}
 */
function instantiateRequest(request, data, options) {
  let target;

  if (!request || !(request instanceof Request)) {
    throw new PluginImplementationError('A Request object must be provided');
  }

  options = options || {};
  Object.assign(options, request.context.toJSON());

  target = new Request(data, options);

  // forward informations from the provided request object
  ['_id', 'index', 'collection'].forEach(resource => {
    if (!target.input.resource[resource]) {
      target.input.resource[resource] = request.input.resource[resource];
    }
  });

  Object.keys(request.input.args).forEach(arg => {
    if (!target.input.args[arg]) {
      target.input.args[arg] = request.input.args[arg];
    }
  });

  if (!target.input.jwt) {
    target.input.jwt = request.input.jwt;
  }

  return target;
}

module.exports = PluginContext;
