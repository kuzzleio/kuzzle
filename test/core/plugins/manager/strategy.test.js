'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginsManager = require('../../../../lib/core/plugins/manager'),
  {
    NotFoundError,
    PluginImplementationError
  } = require('kuzzle-common-objects').errors;

describe('PluginsManager: strategy management', () => {
  let
    kuzzle,
    pluginsManager,
    plugin,
    pluginManagerStrategy,
    foo = {foo: 'bar'};

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    plugin = {
      config: {},
      manifest: {
        name: 'some-plugin-name',
        path: ''
      },
      object: {
        authenticators: {
          SomeStrategy: sinon.stub()
        },
        strategies: {
          someStrategy: {
            config: {
              authenticator: 'SomeStrategy',
              strategyOptions: {
                someStrategy: 'options'
              },
              authenticateOptions: {
                someAuthenticate: 'options'
              },
              fields: ['aField', 'anotherField']
            },
            methods: {
              afterRegister: 'afterRegisterFunction',
              create: 'createFunction',
              delete: 'deleteFunction',
              exists: 'existsFunction',
              getById: 'getByIdFunction',
              getInfo: 'getInfoFunction',
              update: 'updateFunction',
              validate: 'validateFunction',
              verify: 'verifyFunction'
            }
          }
        },
        afterRegisterFunction: sinon.stub(),
        createFunction: sinon.stub(),
        existsFunction: sinon.stub(),
        deleteFunction: sinon.stub(),
        getByIdFunction: sinon.stub(),
        getInfoFunction: sinon.stub(),
        updateFunction: sinon.stub(),
        validateFunction: sinon.stub(),
        verifyFunction: sinon.stub()
      }
    };

    pluginManagerStrategy = {
      strategy: plugin.object.strategies.someStrategy,
      methods: {
        exists: plugin.object.existsFunction,
        create: plugin.object.createFunction,
        update: plugin.object.updateFunction,
        delete: plugin.object.deleteFunction,
        getById: plugin.object.getByIdFunction,
        getInfo: plugin.object.getInfoFunction,
        validate: plugin.object.validateFunction,
        afterRegister: plugin.object.afterRegisterFunction
      },
      owner: plugin.manifest.name
    };

    pluginsManager = new PluginsManager(kuzzle);
    pluginsManager.plugins[plugin.manifest.name] = plugin;
    pluginsManager.strategies.someStrategy = pluginManagerStrategy;
    sinon.resetHistory();
  });

  describe('#getStrategyFields', () => {
    it('should return fields from configuration', () => {
      should(pluginsManager.getStrategyFields('someStrategy'))
        .be.deepEqual(['aField', 'anotherField']);
    });
  });

  describe('#hasStrategyMethod', () => {
    it('should return true if a method exists', () => {
      should(pluginsManager.hasStrategyMethod('someStrategy', 'exists')).be.true();
    });

    it('should false true if a method does not exist', () => {
      should(pluginsManager.hasStrategyMethod('someStrategy', 'notExists')).be.false();
    });
  });

  describe('#getStrategyMethod', () => {
    it('should return a method', () => {
      should(pluginsManager.getStrategyMethod('someStrategy', 'exists')).be.a.Function();
    });
  });

  describe('#initAuthenticators', () => {
    it('should throw if the provided authenticators property is not an object', () => {
      [[], 'foobar', 123, true].forEach(authenticators => {
        plugin.object.authenticators = authenticators;
        should(() => pluginsManager._initAuthenticators(plugin))
          .throw(PluginImplementationError, { id: 'plugin.authenticators.not_an_object'});
      });
    });

    it('should throw if one of the provided authenticators is not a constructor', () => {
      [() => {}, 'foobar', true, 123].forEach(ctor => {
        plugin.object.authenticators.foo = ctor;
        should(() => pluginsManager._initAuthenticators(plugin))
          .throw(PluginImplementationError, { id: 'plugin.authenticators.invalid_authenticator' });
      });
    });
  });

  describe('#initStrategies', () => {
    beforeEach(() => {
      pluginsManager.strategies = {};
      pluginsManager.authenticators[plugin.manifest.name] = {
        SomeStrategy: plugin.object.authenticators.SomeStrategy
      };
      pluginsManager.plugins[plugin.manifest.name].initCalled = true;
    });

    it('should add the strategy in strategies if it is well-formed', done => {
      plugin.object.existsFunction = sinon.stub().returns(foo);
      plugin.object.verifyFunction = sinon.stub().resolves({kuid: 'foo'});

      pluginsManager._initStrategies(plugin);

      should(pluginsManager.strategies.someStrategy.strategy)
        .be.deepEqual(plugin.object.strategies.someStrategy);
      should(pluginsManager.strategies.someStrategy.methods.afterRegister).be.Function();
      should(plugin.object.afterRegisterFunction).be.calledOnce();
      should(plugin.object.afterRegisterFunction.firstCall.args[0])
        .be.instanceOf(plugin.object.authenticators.SomeStrategy);
      should(pluginsManager.strategies.someStrategy.methods.exists).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.create).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.update).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.delete).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.getById).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.getInfo).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.validate).be.Function();
      should(plugin.object.authenticators.SomeStrategy).calledOnce().calledWithNew();


      pluginsManager.strategies.someStrategy.methods.exists(foo)
        .then(result => {
          should(result).be.deepEqual(foo);
          should(plugin.object.existsFunction).be.calledOnce();

          const verifyAdapter = plugin.object.authenticators.SomeStrategy.firstCall.args[1];
          verifyAdapter({}, error => done(error));
        });
    });

    it('should handle plugin names using uppercases', () => {
      // plugin names are stored lowercased
      pluginsManager.plugins[plugin.manifest.name] = plugin;

      plugin.manifest.name = plugin.manifest.name.toUpperCase();

      pluginsManager.authenticators = {
        [plugin.manifest.name]: {
          SomeStrategy: plugin.object.authenticators.SomeStrategy
        }
      };

      plugin.object.existsFunction = sinon.stub().returns(foo);
      plugin.object.verifyFunction = sinon.stub().resolves({kuid: 'foo'});

      pluginsManager._initStrategies(plugin);
      should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(
        plugin.object.strategies.someStrategy);
      should(plugin.object.afterRegisterFunction).be.calledOnce();
    });

    it('method invocation should intercept a thrown error to transform it into PluginImplementationError', () => {
      plugin.object.existsFunction = sinon.stub().throws(new Error('some error'));

      pluginsManager._initStrategies(plugin);
      should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(plugin.object.strategies.someStrategy);
      should(pluginsManager.strategies.someStrategy.methods.exists).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.create).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.update).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.delete).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.getInfo).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.validate).be.Function();

      return should(pluginsManager.strategies.someStrategy.methods.exists(foo)).be.rejectedWith(PluginImplementationError);
    });

    it('should throw if strategies is not a non-empty object', () => {
      const message = /\[some-plugin-name\]: the exposed "strategies" plugin property must be a non-empty object/;

      [{}, [], null, undefined, 'foobar', 123, true].forEach(strategies => {
        plugin.object.strategies = strategies;
        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {message});
      });
    });

    it('should throw if the provided strategy is not an object', () => {
      [[], null, undefined, 'foobar', 123, true].forEach(strategy => {
        plugin.object.strategies.someStrategy = strategy;
        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.invalid_description'
          });
      });
    });

    it('should throw if methods is not an object', () => {
      [[], null, undefined, 'foobar', 123, true].forEach(methods => {
        plugin.object.strategies.someStrategy.methods = methods;
        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, { id: 'plugin.strategy.invalid_methods' });
      });
    });

    it('should throw if config is not an object', () => {
      [[], null, undefined, 'foobar', 123, true].forEach(config => {
        const message = new RegExp(`\\[some-plugin-name\\] Strategy someStrategy: expected a "config" property of type "object", got: ${config}`);
        plugin.object.strategies.someStrategy.config = config;
        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {message});
      });
    });

    it('should throw if a required method is invalid', () => {
      [[], null, undefined, {}, 123, true].forEach(fn => {
        plugin.object.strategies.someStrategy.methods.exists = fn;
        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.invalid_method_type'
          });
      });
    });

    it('should throw if a mandatory method is not exposed by the plugin object', () => {
      ['exists', 'create', 'update', 'delete', 'validate', 'verify'].forEach(methodName => {
        const
          fnName = methodName + 'Function';

        delete plugin.object[fnName];

        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.missing_method_function'
          });

        plugin.object[fnName] = sinon.stub();
      });
    });

    it('should throw if an optional method is specified but with an invalid value', () => {
      ['getInfo', 'getById', 'afterRegister'].forEach(methodName => {
        const clone = JSON.parse(JSON.stringify(plugin));

        [[], {}, 123, false].forEach(name => {
          clone.object.strategies.someStrategy.methods[methodName] = name;
          should(() => pluginsManager._initStrategies(clone))
            .throw(PluginImplementationError, {
              id: 'plugin.strategy.invalid_method_type'
            });
        });
      });
    });

    it('should throw if an optional method is specified but does not point to a function', () => {
      ['getInfo', 'getById', 'afterRegister'].forEach(methodName => {
        const fnName = methodName + 'Function';

        delete plugin.object[fnName];

        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.missing_method_function'
          });

        plugin.object[fnName] = sinon.stub();
      });
    });

    it('should throw if the strategy authenticator is invalid or missing', () => {
      [[], {}, 123, null, undefined, true].forEach(authenticator => {
        plugin.object.strategies.someStrategy.config.authenticator = authenticator;

        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.invalid_authenticator'
          });
      });
    });

    it('should throw if the provided authenticator is not listed in this.authenticators', () => {
      plugin.object.strategies.someStrategy.config.authenticator = 'foobar';
      should(() => pluginsManager._initStrategies(plugin))
        .throw(PluginImplementationError, {
          id: 'plugin.strategy.unknown_authenticator'
        });
    });

    it('should throw if the "strategyOptions" config is invalid', () => {
      [[], 'foobar', 123, false].forEach(opts => {
        plugin.object.strategies.someStrategy.config.strategyOptions = opts;

        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.invalid_option'
          });
      });
    });

    it('should throw if the "authenticateOptions" config is invalid', () => {
      [[], 'foobar', 123, false].forEach(opts => {
        plugin.object.strategies.someStrategy.config.authenticateOptions = opts;

        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.invalid_option'
          });
      });
    });

    it('should throw if the "fields" config is invalid', () => {
      [{}, 'foobar', 123, false].forEach(opts => {
        plugin.object.strategies.someStrategy.config.fields = opts;

        should(() => pluginsManager._initStrategies(plugin))
          .throw(PluginImplementationError, {
            id: 'plugin.strategy.invalid_fields'
          });
      });
    });

    it('should unregister a strategy first if already registered', () => {
      sinon.spy(pluginsManager, 'unregisterStrategy');

      pluginsManager._initStrategies(plugin);

      should(pluginsManager.unregisterStrategy).not.be.called();

      pluginsManager._initStrategies(plugin);

      should(pluginsManager.unregisterStrategy)
        .calledOnce()
        .calledWith(plugin.manifest.name, 'someStrategy');
    });
  });

  describe('#verifyAdapter', () => {
    let verifyAdapter;

    beforeEach(() => {
      pluginsManager.authenticators[plugin.manifest.name] = {
        SomeStrategy: plugin.object.authenticators.SomeStrategy
      };
      pluginsManager.plugins[plugin.manifest.name].initCalled = true;
      pluginsManager._initStrategies(plugin);
      verifyAdapter = plugin.object.authenticators.SomeStrategy.firstCall.args[1];
    });

    it('should reject if the plugin returns a non-thenable value', done => {
      plugin.object.verifyFunction.returns(null);
      verifyAdapter('foo', 'bar', 'baz', (err, res, msg) => {
        try {
          should(res).be.undefined();
          should(msg).be.undefined();
          should(err)
            .instanceOf(PluginImplementationError)
            .match({ id: 'plugin.strategy.invalid_verify_return' });
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should reject if the plugin resolves to a non-false non-object value', done => {
      plugin.object.verifyFunction.resolves(true);
      verifyAdapter('foo', 'bar', (err, res, msg) => {
        try {
          should(res).be.undefined();
          should(msg).be.undefined();
          should(err)
            .instanceOf(PluginImplementationError)
            .match({message: /\[some-plugin-name\] Strategy someStrategy: invalid authentication strategy result/});
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should reject if the plugin resolves to a non-string kuid', done => {
      plugin.object.verifyFunction.resolves({kuid: 123});
      verifyAdapter('foo', 'bar', (err, res, msg) => {
        try {
          should(res).be.undefined();
          should(msg).be.undefined();
          should(err)
            .instanceOf(PluginImplementationError)
            .match({message: /\[some-plugin-name\] Strategy someStrategy: invalid authentication kuid returned: expected a string, got a number/});
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should resolve to "false" if the plugins refuse the provided credentials', done => {
      plugin.object.verifyFunction.resolves(false);
      verifyAdapter((err, res, msg) => {
        try {
          should(res).be.false();
          should(msg).be.eql({message: null});
          should(err).be.null();
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should provide a default message if the plugins rejects a login without one', done => {
      plugin.object.verifyFunction.resolves({});
      verifyAdapter((err, res, msg) => {
        try {
          should(res).be.false();
          should(msg).be.eql({message: 'Unable to log in using the strategy "someStrategy"'});
          should(err).be.null();
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should relay the plugin  message if one is provided', done => {
      plugin.object.verifyFunction.resolves({message: '"NONE SHALL PASS!" -The Black Knight'});
      verifyAdapter((err, res, msg) => {
        try {
          should(res).be.false();
          should(msg).be.eql({message: '"NONE SHALL PASS!" -The Black Knight'});
          should(err).be.null();
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should reject if the plugin returns an invalid kuid', done => {
      kuzzle.repositories.user.load.resolves(null);
      plugin.object.verifyFunction.resolves({kuid: 'Waldo'});

      verifyAdapter((err, res, msg) => {
        try {
          should(res).be.undefined();
          should(msg).be.undefined();
          should(err)
            .instanceOf(PluginImplementationError)
            .match({message: /\[some-plugin-name\] Strategy someStrategy: returned an unknown Kuzzle user identifier/});
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });
  });

  describe('#unregisterStrategy', () => {
    it('should remove a strategy using its provided name', () => {
      pluginsManager.unregisterStrategy(plugin.manifest.name, 'someStrategy');
      should(pluginsManager.strategies).be.an.Object().and.be.empty();
      should(kuzzle.passport.unuse).calledWith('someStrategy');
    });

    it('should throw if the strategy does not exist', () => {
      should(() => pluginsManager.unregisterStrategy(plugin.manifest.name, 'foobar'))
        .throw(NotFoundError, { id: 'plugin.strategy.strategy_not_found' });
    });

    it('should throw if not the owner of the strategy', () => {
      should(() => pluginsManager.unregisterStrategy('Frank William Abagnale Jr.', 'someStrategy'))
        .throw(PluginImplementationError, { id: 'plugin.strategy.unauthorized_removal' });
    });
  });

  describe('#registerStrategy', () => {
    it('should add the strategy to strategies object if init method has not been called', () => {
      const strategy = {
        config: {
          authenticator: 'SomeStrategy'
        },
        methods: {
          create: sinon.stub(),
          delete: sinon.stub(),
          exists: sinon.stub(),
          getById: sinon.stub(),
          getInfo: sinon.stub(),
          update: sinon.stub(),
          validate: sinon.stub(),
          verify: sinon.stub()
        }
      };

      pluginsManager.registerStrategy(plugin.manifest.name, 'foobar', strategy);

      should(plugin.object.strategies.foobar).be.eql(strategy);
    });
  });
});
