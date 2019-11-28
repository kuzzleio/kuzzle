/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  errorsManager = require('../../util/errors'),
  didYouMean = require('../../util/didYouMean'),
  debug = require('../../util/debug')('kuzzle:plugins'),
  PluginContext = require('./context'),
  PrivilegedPluginContext = require('./privilegedContext'),
  async = require('async'),
  path = require('path'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  fs = require('fs'),
  { errors: { KuzzleError } } = require('kuzzle-common-objects'),
  Manifest = require('./manifest'),
  { loadPluginsErrors } = require('../../config/error-codes'),
  { has, get, isPlainObject } = require('../../util/safeObject'),
  { BaseController } = require('../../api/controllers/base');

const
  assertionError = errorsManager.wrap('plugin', 'assert'),
  runtimeError = errorsManager.wrap('plugin', 'runtime'),
  strategyError = errorsManager.wrap('plugin', 'strategy'),
  controllerError = errorsManager.wrap('plugin', 'controller');

/**
 * @class PluginsManager
 * @param {Kuzzle} kuzzle
 */
class PluginsManager {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.plugins = {};
    this.pipes = {};

    // Map.<controller, BaseController instance >
    this.controllers = new Map();

    this.strategies = {};
    this.routes = [];
    this.pluginsDir = path.resolve(
      path.join(this.kuzzle.rootPath, 'plugins/enabled'));

    /**
     * @example
     * {
     *   pluginName: {
     *     authName: <constructor>,
     *     authname2: <constructor>,
     *     ...
     *   },
     *   pluginName2: {
     *     ...
     *   }
     * }
     *
     * This structure prevents authenticator names collisions between
     * multiple auth. plugins
     */
    this.authenticators = {};

    this.config = kuzzle.config.plugins;
  }

  /**
   * Load plugin located in "plugins/enabled" folder and from CLI arguments
   *
   * @param  {Array.<string>} plugins - Plugins passed as CLI arguments
   * @throws PluginImplementationError - Throws when an error occurs when loading a plugin
   */
  init(additionalPlugins = []) {
    this.plugins = this.load(additionalPlugins);
  }

  /**
   * Used to dump loaded plugin feature into serverInfo route / cli
   *
   * @returns {object}
   */
  getPluginsDescription() {
    const pluginsDescription = {};

    Object.keys(this.plugins).forEach(plugin => {
      const
        pluginInfo = this.plugins[plugin],
        description = {
          version: pluginInfo.version,
          manifest: pluginInfo.manifest,
          hooks: [],
          pipes: [],
          controllers: [],
          routes: [],
          strategies: []
        };

      if (pluginInfo.object) {
        if (has(pluginInfo.object, 'hooks')) {
          description.hooks = _.uniq(Object.keys(pluginInfo.object.hooks));
        }

        if (has(pluginInfo.object, 'pipes')) {
          description.pipes = _.uniq(Object.keys(pluginInfo.object.pipes));
        }

        if (has(pluginInfo.object, 'controllers')) {
          description.controllers = _
            .uniq(Object.keys(pluginInfo.object.controllers))
            .map(item => `${pluginInfo.manifest.name}/${item}`);
        }

        if (has(pluginInfo.object, 'routes')) {
          description.routes = _.uniq(pluginInfo.object.routes);
        }

        if (has(pluginInfo.object, 'strategies')) {
          description.strategies = Object.keys(pluginInfo.object.strategies);
        }
      } else {
        this.kuzzle.log.warn(`[Plugin manager]: Unable to load features from plugin "${plugin}"`);
      }

      pluginsDescription[description.manifest.name] = description;

      debug('[%s] reading plugin configuration: %a', plugin, description);
    });

    return pluginsDescription;
  }

  /**
   * Register plugins feature to Kuzzle
   *
   * @returns {Promise}
   *
   * @throws PluginImplementationError - Throws when an error occurs when registering a plugin
   */
  run () {
    if (Object.keys(this.plugins).length === 0) {
      return Bluebird.resolve();
    }

    // register regular plugins features
    return Bluebird.all(Object.keys(this.plugins).map(pluginName => {
      const
        plugin = this.plugins[pluginName],
        {
          pipeWarnTime,
          pipeTimeout,
          initTimeout
        } = this.config.common;


      debug(
        '[%s] starting plugin in "%s" mode',
        plugin.manifest.name,
        plugin.config.privileged ? 'privileged' : 'standard');

      const pluginContext = plugin.config.privileged
        ? new PrivilegedPluginContext(this.kuzzle, plugin.manifest.name)
        : new PluginContext(this.kuzzle, plugin.manifest.name);

      return Bluebird
        .resolve(plugin.object.init(plugin.config, pluginContext))
        .timeout(initTimeout)
        .then(initStatus => {
          if (initStatus === false) {
            runtimeError.throw('failed_init', plugin.manifest.name);
          }

          plugin.initCalled = true;

          if (plugin.object.controllers) {
            this._initControllers(plugin);
          }

          if (plugin.object.authenticators) {
            this._initAuthenticators(plugin);
          }

          if (plugin.object.strategies) {
            this._initStrategies(plugin);
          }

          if (plugin.object.hooks) {
            this._initHooks(plugin);
          }

          if (plugin.object.pipes) {
            this._initPipes(plugin, pipeWarnTime, pipeTimeout);
          }

          debug('[%s] plugin started', plugin.manifest.name);
        });
    }));
  }

  /**
   * Emit a "pipe" event, returning a promise resolved once all registered
   * pipe listeners have finished processing the provided data.
   *
   * Each listener has to resolve its promise with an updated version of the
   * provided data, which is then passed to the next listener, and so on in
   * series until the last listener resolves.
   *
   * @warning Critical code section
   *  - pipes can be triggered thousand of time per second
   *
   * @param  {Array.<string>} events
   * @param  {*} data
   * @return {Promise.<*>}
   */
  pipe (events, data, ...info) {
    debug('trigger "%s" event', events);

    const preparedPipes = [cb => cb(null, data, ...info)];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      if (has(this.pipes, event)) {
        for (const pipe of this.pipes[event]) {
          preparedPipes.push(pipe);
        }
      }
    }

    if (preparedPipes.length === 1) {
      return Bluebird.resolve(data);
    }

    return new Bluebird((resolve, reject) => {
      async.waterfall(preparedPipes, (error, result) => {
        if (error) {
          if (error instanceof KuzzleError) {
            return reject(error);
          }

          return reject(runtimeError.getFrom(
            error,
            'unexpected_error',
            error.message));
        }

        resolve(result);
      });
    });
  }

  /**
   * @param {string} strategyName
   * @returns {string[]}
   */
  getStrategyFields (strategyName) {
    return this.strategies[strategyName].strategy.config.fields || [];
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {boolean}
   */
  hasStrategyMethod (strategyName, methodName) {
    const strategy = get(this.strategies, strategyName);
    return strategy && has(strategy.methods, methodName);
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {function}
   */
  getStrategyMethod (strategyName, methodName) {
    return this.strategies[strategyName].methods[methodName];
  }

  /**
   * Returns the list of registered passport strategies
   * @returns {string[]}
   */
  listStrategies () {
    return Object.keys(this.strategies);
  }

  /**
   * Checks if a strategy is well-formed
   *
   * @param {string} pluginName
   * @param {string} strategyName
   * @param {object} strategy
   * @throws {PluginImplementationError} If the strategy is invalid
   */
  validateStrategy (pluginName, strategyName, strategy) {
    const errorPrefix = `[${pluginName}] Strategy ${strategyName}:`;

    if (!isPlainObject(strategy)) {
      strategyError.throw('invalid_description', errorPrefix, strategy);
    }

    if (!isPlainObject(strategy.methods)) {
      strategyError.throw('invalid_methods', errorPrefix, strategy.methods);
    }

    const pluginObject = this.plugins[pluginName.toLowerCase()].object;

    // required methods check
    ['exists', 'create', 'update', 'delete', 'validate', 'verify'].forEach(methodName => {
      if (!_.isString(strategy.methods[methodName])) {
        strategyError.throw(
          'invalid_method_type',
          errorPrefix,
          methodName,
          strategy.methods[methodName]);
      }

      if (!_.isFunction(pluginObject[strategy.methods[methodName]])) {
        strategyError.throw(
          'missing_method_function',
          errorPrefix,
          strategy.methods[methodName]);
      }
    });

    // optional methods check
    ['getInfo', 'getById', 'afterRegister'].forEach(name => {
      const optionalMethodName = strategy.methods[name];

      if (!_.isNil(optionalMethodName)) {
        if (!_.isString(optionalMethodName)) {
          strategyError.throw(
            'invalid_method_type',
            errorPrefix,
            name,
            optionalMethodName);
        }

        if (!_.isFunction(pluginObject[optionalMethodName])) {
          strategyError.throw(
            'missing_method_function',
            errorPrefix,
            optionalMethodName);
        }
      }
    });

    if (!isPlainObject(strategy.config)) {
      strategyError.throw('invalid_config', errorPrefix, strategy.config);
    }

    if (typeof strategy.config.authenticator !== 'string') {
      strategyError.throw(
        'invalid_authenticator',
        errorPrefix,
        strategy.config.authenticator);
    }
    else if (!this.authenticators[pluginName]
      || !this.authenticators[pluginName][strategy.config.authenticator]
    ) {
      strategyError.throw(
        'unknown_authenticator',
        errorPrefix,
        strategy.config.authenticator);
    }

    for (const optionName of ['strategyOptions', 'authenticateOptions']) {
      const options = strategy.config[optionName];

      if (!_.isNil(options) && !isPlainObject(options)) {
        strategyError.throw('invalid_option', errorPrefix, optionName, options);
      }
    }

    if (!_.isNil(strategy.config.fields) && !Array.isArray(strategy.config.fields)) {
      strategyError.throw(
        'invalid_fields',
        errorPrefix,
        strategy.config.fields);
    }
  }

  /**
   * Register a pipe function on an event
   *
   * @param {object} plugin
   * @param {number} warnDelay - delay before a warning is issued
   * @param {number} timeoutDelay - delay after which the function is timed out
   * @param {string} event name
   * @param {string|function} fn - function to attach
   */
  registerPipe(plugin, warnDelay, timeoutDelay, event, fn) {
    debug('[%s] register pipe on event "%s"', plugin.manifest.name, event);

    if (!has(this.pipes, event)) {
      this.pipes[event] = [];
    }

    this.pipes[event].push((data, ...info) => {
      const callback = info.pop();
      const name = plugin.manifest.name;
      let
        pipeWarnTimer,
        pipeTimeoutTimer,
        timedOut = false;

      if (warnDelay) {
        pipeWarnTimer = setTimeout(() => {
          this.kuzzle.log.warn(`Plugin ${name} pipe for event '${event}' exceeded ${warnDelay}ms to execute.`);
        }, warnDelay);
      }

      if (timeoutDelay) {
        pipeTimeoutTimer = setTimeout(() => {
          const error = runtimeError.get(
            'pipe_timeout',
            name,
            event,
            timeoutDelay);

          this.kuzzle.log.error(error.message);

          timedOut = true;
          callback(error);
        }, timeoutDelay);
      }

      const cb = (err, pipeResponse, ...info2) => {
        if (pipeWarnTimer !== undefined) {
          clearTimeout(pipeWarnTimer);
        }
        if (pipeTimeoutTimer !== undefined) {
          clearTimeout(pipeTimeoutTimer);
        }

        if (!timedOut) {
          callback(err, pipeResponse, ...info2);
        }
      };

      try {
        const pipeResponse = (typeof fn === 'function')
          ? fn(data, ...info, cb)
          : plugin.object[fn](data, ...info, cb);

        if (typeof pipeResponse === 'object'
          && pipeResponse !== null
          && typeof pipeResponse.then === 'function'
          && typeof pipeResponse.catch === 'function'
        ) {
          pipeResponse
            .then(request => cb(null, request))
            .catch(error => cb(error));
        }
      } catch (error) {
        if (error instanceof KuzzleError) {
          return cb(error);
        }

        cb(runtimeError.getFrom(error, 'unexpected_error', error.message));
      }
    });
  }

  /**
   * Register a listener function on an event
   *
   * @param {object} plugin
   * @param {string} event
   * @param {string|function} fn - function to attach
   */
  registerHook(plugin, event, fn) {
    debug('[%s] register hook on event "%s"', plugin.manifest.name, event);

    this.kuzzle.on(event, message => {
      try {
        if (typeof fn === 'function') {
          fn(message, event);
        } else {
          plugin.object[fn](message, event);
        }
      } catch (error) {
        runtimeError.throwFrom(error, 'unexpected_error', error.message);
      }
    });
  }

  /**
   * Registers an authentication strategy.
   * If the plugin init method has not been called yet, add the strategy to
   * the plugin.object.strategies object.
   *
   * @param {string} pluginName - plugin name
   * @param {string} strategyName - strategy name
   * @param {object} strategy - strategy properties
   * @throws {PluginImplementationError} If the strategy is invalid or if
   *                                     registration fails
   */
  registerStrategy(pluginName, strategyName, strategy) {
    // only add the strategy to the strategies object if the init method
    // has not been called
    const plugin = this.plugins[pluginName.toLowerCase()];

    if (! plugin.initCalled) {
      plugin.object.strategies = plugin.object.strategies || {};
      plugin.object.strategies[strategyName] = strategy;

      return;
    }

    const errorPrefix = `[${pluginName}] Strategy ${strategyName}:`;
    this.validateStrategy(pluginName, strategyName, strategy);

    if (has(this.strategies, strategyName)) {
      this.unregisterStrategy(pluginName, strategyName);
    }

    const methods = {};

    // wrap plugin methods to force their context and to
    // convert uncaught exception into PluginImplementationError
    // promise rejections
    for (const methodName of Object.keys(strategy.methods).filter(
      name => name !== 'verify')
    ) {
      methods[methodName] = (...args) => {
        return new Bluebird((resolve, reject) => {
          try {
            resolve(
              plugin.object[strategy.methods[methodName]].bind(
                plugin.object)(...args)
            );
          } catch (error) {
            reject(error instanceof KuzzleError
              ? error
              : runtimeError.getFrom(error, 'unexpected_error', error.message)
            );
          }
        });
      };
    }

    const
      opts = Object.assign(
        {},
        strategy.config.strategyOptions,
        {passReqToCallback: true}
      ),
      verifyAdapter = (...args) => {
        const
          callback = args[args.length - 1],
          ret = plugin.object[strategy.methods.verify](...args.slice(0, -1));

        // catching plugins returning non-thenable content
        if (!ret || !_.isFunction(ret.then)) {
          return callback(strategyError.get(
            'invalid_verify_return',
            errorPrefix,
            ret));
        }

        let message = null;

        ret
          .then(result => {
            if (result === false) {
              return false;
            }

            if (!isPlainObject(result)) {
              strategyError.throw('invalid_verify_resolve', errorPrefix);
            }

            if (result.kuid !== null && result.kuid !== undefined) {
              if (typeof result.kuid === 'string') {
                return this.kuzzle.repositories.user.load(result.kuid);
              }

              strategyError.throw(
                'invalid_kuid',
                errorPrefix,
                typeof result.kuid);
            }

            if (result.message && typeof result.message === 'string') {
              message = result.message;
            }
            else {
              message = `Unable to log in using the strategy "${strategyName}"`;
            }

            return false;
          })
          .then(result => {
            if (result === null) {
              strategyError.throw('unknown_kuid', errorPrefix);
            }

            callback(null, result, {message});
            return null;
          })
          .catch(error => callback(error));
      };

    try {
      const
        Ctor = this.authenticators[pluginName][strategy.config.authenticator],
        instance = new Ctor(opts, verifyAdapter);

      this.strategies[strategyName] = { strategy, methods, owner: pluginName };
      this.kuzzle.passport.use(
        strategyName,
        instance,
        strategy.config.authenticateOptions);

      if (methods.afterRegister) {
        methods.afterRegister(instance);
      }
    }
    catch (e) {
      strategyError.throwFrom(
        e,
        'failed_registration',
        strategyName,
        e.message);
    }
  }

  /**
   * Unregister
   * @param {string} pluginName
   * @param  {string} strategyName
   * @throws {PluginImplementationError} If not the owner of the strategy or if strategy
   *                                     does not exist
   */
  unregisterStrategy (pluginName, strategyName) {
    const strategy = this.strategies[strategyName];

    if (strategy) {
      if (strategy.owner !== pluginName) {
        strategyError.throw('unauthorized_removal', strategyName);
      }

      delete this.strategies[strategyName];
      this.kuzzle.passport.unuse(strategyName);
    } else {
      strategyError.throw('strategy_not_found', strategyName);
    }
  }

  /**
   * @param {object} plugin
   * @param {number} pipeWarnTime
   * @param {number} pipeTimeout
   */
  _initPipes (plugin, pipeWarnTime, pipeTimeout) {
    const methodsList = getMethods(plugin.object);

    let
      _warnTime = pipeWarnTime,
      _timeout = pipeTimeout;

    if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
      _warnTime = plugin.config.pipeWarnTime;
    }
    if (plugin.config && plugin.config.pipeTimeout !== undefined) {
      _timeout = plugin.config.pipeTimeout;
    }

    _.forEach(plugin.object.pipes, (fn, event) => {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if (typeof target !== 'function'
          && typeof plugin.object[target] !== 'function'
        ) {
          const message = typeof target === 'string'
            ? didYouMean(target, methodsList)
            : '';

          assertionError.throw('invalid_pipe', event, target, message);
        }

        this.registerPipe(plugin, _warnTime, _timeout, event, target);
      }
    });
  }

  /**
   * @param {object} plugin
   */
  _initHooks (plugin) {
    const methodsList = getMethods(plugin.object);

    _.forEach(plugin.object.hooks, (fn, event) => {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if (
          typeof target !== 'function'
          && typeof plugin.object[target] !== 'function'
        ) {
          const message = typeof target === 'string'
            ? didYouMean(target, methodsList)
            : '';

          assertionError.throw('invalid_hook', event, target, message);
        }

        this.registerHook(plugin, event, target);
      }
    });
  }

  /**
   * Init plugin controllers
   *
   * @param {object} plugin
   * @returns {boolean}
   */
  _initControllers (plugin) {
    Object.keys(plugin.object.controllers).forEach(controller => {
      debug(
        '[%s][%s] starting controller registration',
        plugin.manifest.name,
        controller);

      const
        methodsList = getMethods(plugin.object),
        controllerName = `${plugin.manifest.name}/${controller}`,
        description = plugin.object.controllers[controller],
        errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.manifest.name}":`;

      if (!isPlainObject(description)) {
        controllerError.throw(
          'invalid_description',
          errorControllerPrefix,
          typeof description);
      }

      Object.keys(description).forEach(action => {
        debug(
          '[%s][%s][%s] starting action controller registration',
          plugin.manifest.name,
          controller,
          action);

        if ( typeof description[action] !== 'function'
          && typeof plugin.object[description[action]] !== 'function'
        ) {
          const suggestion = typeof description[action] === 'string'
            ? didYouMean(description[action], methodsList)
            : '';

          controllerError.throw(
            'invalid_action',
            errorControllerPrefix,
            controller,
            action,
            suggestion);
        }

        let apiController = this.controllers.get(controllerName);

        if (!apiController) {
          apiController = new BaseController();
          this.controllers.set(controllerName, apiController);
        }

        if (typeof description[action] === 'function') {
          apiController._addAction(action, description[action]);
        }
        else {
          apiController._addAction(
            action,
            plugin.object[description[action]].bind(plugin.object));
        }
      });
    });

    const
      httpVerbs = ['get', 'head', 'post', 'put', 'delete', 'patch'],
      routeProperties = ['verb', 'url', 'controller', 'action'],
      controllerNames = Object.keys(plugin.object.controllers);

    if (plugin.object.routes) {
      plugin.object.routes.forEach(route => {
        const
          controllerName = `${plugin.manifest.name}/${route.controller}`,
          errorRoutePrefix = `Unable to inject API route "${JSON.stringify(route)}" from plugin "${plugin.manifest.name}":`;

        Object.keys(route).forEach(key => {
          if (routeProperties.indexOf(key) === -1) {
            controllerError.throw(
              'unexpected_route_property',
              errorRoutePrefix,
              key,
              didYouMean(key, routeProperties));
          }

          if ( typeof route[key] !== 'string'
            || route[key].length === 0 && key !== 'url'
          ) {
            controllerError.throw('invalid_route_property', errorRoutePrefix, key);
          }
        });

        const apiController = this.controllers.get(controllerName);

        if (!apiController) {
          controllerError.throw(
            'undefined_controller',
            errorRoutePrefix,
            route.controller,
            didYouMean(route.controller, controllerNames));
        }

        if (!apiController._isAction(route.action)) {
          const actionNames = Array.from(apiController._actions);
          controllerError.throw(
            'undefined_action',
            errorRoutePrefix,
            route.action,
            didYouMean(route.action, actionNames));
        }

        if (httpVerbs.indexOf(route.verb.toLowerCase()) === -1) {
          controllerError.throw(
            'unsupported_verb',
            errorRoutePrefix,
            httpVerbs.join(', '),
            didYouMean(route.verb, httpVerbs));
        }

        debug(
          '[%s] binding HTTP route "%s" to controller "%s"',
          plugin.manifest.name,
          route.url,
          route.controller);

        route.url = `/${plugin.manifest.name}${route.url}`;
        route.controller = controllerName;

        this.routes.push(route);
      });
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initStrategies (plugin) {
    const errorPrefix = `[${plugin.manifest.name}]:`;

    if ( !isPlainObject(plugin.object.strategies)
      || _.isEmpty(plugin.object.strategies)
    ) {
      strategyError.throw('invalid_definition', errorPrefix);
    }

    for (const name of Object.keys(plugin.object.strategies)) {
      this.registerStrategy(
        plugin.manifest.name,
        name,
        plugin.object.strategies[name]);
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initAuthenticators (plugin) {
    const errorPrefix = `[${plugin.manifest.name}]:`;

    if (!isPlainObject(plugin.object.authenticators)) {
      errorsManager.throw(
        'plugin',
        'authenticators',
        'not_an_object',
        errorPrefix);
    }

    for (const authenticator of Object.keys(plugin.object.authenticators)) {
      if (!isConstructor(plugin.object.authenticators[authenticator])) {
        errorsManager.throw(
          'plugin',
          'authenticators',
          'invalid_authenticator',
          errorPrefix,
          authenticator);
      }
    }

    this.authenticators[plugin.manifest.name] = Object.assign(
      {},
      plugin.object.authenticators);
  }

  /**
   * Load detected plugins in memory
   *
   * @returns {object} list of loaded plugin
   */
  load(additionalPlugins = []) {
    const
      loadedPlugins = {},
      getPluginDir = plugin => {
        return additionalPlugins.includes(plugin)
          ? path.resolve(path.join(this.kuzzle.rootPath, 'plugins/available'))
          : this.pluginsDir;
      };

    let plugins = [];

    try {
      plugins = fs.readdirSync(this.pluginsDir);
    }
    catch (e) {
      assertionError.throw('invalid_plugins_dir', this.pluginsDir, e.message);
    }

    // Add CLI enabled plugins.
    // See CLI `start` command `--enable-plugins` option.
    plugins = additionalPlugins
      .filter(plugin => !plugins.includes(plugin))
      .concat(plugins);

    for (const plugin of plugins) {
      const
        pluginDir = getPluginDir(plugin),
        pluginPath = path.join(pluginDir, plugin);

      try {
        fs.statSync(pluginPath).isDirectory();
      }
      catch (e) {
        assertionError.throw('cannot_load', pluginPath, e.message);
      }
    }

    debug('loading plugins: %a', plugins);

    for (const relativePluginPath of plugins) {
      const
        pluginDir = getPluginDir(relativePluginPath),
        pluginPath = path.resolve(pluginDir, relativePluginPath),
        packageJsonPath = `${pluginPath}/package.json`,
        manifest = new Manifest(this.kuzzle, pluginPath);

      manifest.load();

      const
        plugin = {
          manifest,
          initCalled: false,
          version: null,
          object: null,
          config: this.config[manifest.name]
            ? JSON.parse(JSON.stringify(this.config[manifest.name]))
            : {}
        };

      // load plugin version if exists
      if (fs.existsSync(packageJsonPath)) {
        plugin.version = require(packageJsonPath).version;
      }

      // load customs errors configuration file
      if (plugin.manifest.raw.errors) {
        try {
          const pluginCode = this.config[plugin.manifest.name] && this.config[plugin.manifest.name]._pluginCode
            ? this.config[plugin.manifest.name]._pluginCode
            : 0x00;
          loadPluginsErrors(plugin.manifest.raw, pluginCode);
          this.kuzzle.log.info(`[${plugin.manifest.name}] Custom errors successfully loaded.`);
        }
        catch (err) {
          if ( err.message.match(/Error configuration file/i)
            || err instanceof SyntaxError
          ) {
            errorsManager.throwFrom(
              err,
              'plugin',
              'manifest',
              'invalid_errors',
              plugin.manifest.name,
              err.message);
          }

          throw err;
        }
      }

      // load plugin object
      try {
        const PluginClass = require(pluginPath);
        plugin.object = new PluginClass();
      }
      catch (e) {
        if (e.message.match(/not a constructor/i)) {
          assertionError.throw('not_a_constructor', plugin.manifest.name);
        }

        runtimeError.throwFrom(e, 'unexpected_error', e.message);
      }

      // check if the plugin exposes a "init" method
      if (typeof plugin.object.init !== 'function') {
        assertionError.throw('init_not_found', plugin.manifest.name);
      }

      // check plugin privileged prerequisites
      // user need to acknowledge privileged mode in plugin configuration
      if (plugin.config.privileged) {
        if (!plugin.manifest.privileged) {
          assertionError.throw('privileged_not_supported', plugin.manifest.name);
        }
      }
      else if (plugin.manifest.privileged) {
        assertionError.throw('privileged_not_set', plugin.manifest.name);
      }

      const key = plugin.manifest.name.toLowerCase();

      if (loadedPlugins[key]) {
        assertionError.throw('name_already_exists', key);
      }

      loadedPlugins[key] = plugin;
    }

    return loadedPlugins;
  }
}

/**
 * Test if the provided argument is a constructor or not
 *
 * @param  {*} arg
 * @return {Boolean}
 */
function isConstructor (arg) {
  try {
    Reflect.construct(Object, [], arg);
  } catch (e) {
    return false;
  }

  return true;
}

function getMethods (object) {
  const prototype = Object.getPrototypeOf(object);

  const instanceMethods = Object.getOwnPropertyNames(prototype)
    .filter(method => ['init', 'constructor'].indexOf(method) === -1);

  const objectMethods = Object.getOwnPropertyNames(object)
    .filter(key => typeof object[key] === 'function');

  return [...instanceMethods, ...objectMethods];
}

module.exports = PluginsManager;
