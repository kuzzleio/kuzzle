'use strict';

const util = require('util');

const _ = require('lodash');
const should = require('should');
const mockrequire = require('mock-require');
const { Client: ElasticsearchClient } = require('@elastic/elasticsearch');

const { EmbeddedSDK } = require('../../../lib/core/shared/sdk/embeddedSdk');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const FsMock = require('../../mocks/fs.mock');

describe('Backend', () => {
  let application;
  let fsStub;
  let Backend;

  beforeEach(() => {
    fsStub = new FsMock();
    fsStub.existsSync.returns(true);
    fsStub.readFileSync.returns('ref: refs/master');

    mockrequire('fs', fsStub);
    mockrequire('../../../lib/kuzzle', KuzzleMock);

    ({ Backend } = mockrequire.reRequire('../../../lib/core/application/backend'));

    application = new Backend('black-mesa');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#_instanceProxy', () => {
    it('should return plugin definition and an init function', () => {
      application._pipes = 'pipes';
      application._hooks = 'hooks';
      application._controllers = 'controllers';

      const instance = application._instanceProxy;
      instance.init(null, 'context');

      should(instance.pipes).be.eql('pipes');
      should(instance.hooks).be.eql('hooks');
      should(instance.api).be.eql('controllers');
    });
  });

  describe('#sdk', () => {
    it('should return the embedded sdk', async () => {
      await application.start();

      should(application.sdk).be.instanceOf(EmbeddedSDK);
    });

    it('should throw an error if the application is not started', () => {
      should(() => {
        /* eslint-disable-next-line no-unused-expressions */
        application.sdk;
      }).throwError({ id: 'plugin.runtime.unavailable_before_start' });
    });
  });

  describe('#start', () => {
    it('should call kuzzle.start with an instantiated plugin and options', async () => {
      application.version = '42.21.84';
      application._vaultKey = 'vaultKey';
      application._secretsFile = 'secretsFile';
      application._plugins = {};
      application._support = {
        mappings: 'mappings',
        fixtures: 'fixtures',
        securities: 'securities',
      };

      await application.start();

      should(global.kuzzle.start).be.calledOnce();

      const [plugin, options] = global.kuzzle.start.getCall(0).args;

      should(plugin.application).be.true();
      should(plugin.name).be.eql('black-mesa');
      should(plugin.version).be.eql('42.21.84');
      should(plugin.commit).be.String();
      should(plugin.instance).be.eql(application._instanceProxy);

      should(options.secretsFile).be.eql(application._secretsFile);
      should(options.vaultKey).be.eql(application._vaultKey);
      should(options.plugins)
        .have.keys('kuzzle-plugin-logger', 'kuzzle-plugin-auth-passport-local');
      should(options.mappings).be.eql(application._support.mappings);
      should(options.fixtures).be.eql(application._support.fixtures);
      should(options.securities).be.eql(application._support.securities);
    });

    it('should only submit the configured embedded plugins', async () => {
      application.config.content.plugins.common.include = ['foo'];

      await should(application.start()).rejectedWith(/Cannot find module 'foo'.*/);

      application.config.content.plugins.common.include = ['kuzzle-plugin-logger'];

      await application.start();

      should(global.kuzzle.start).be.calledOnce();

      const [, options] = global.kuzzle.start.getCall(0).args;

      should(options.plugins).have.keys('kuzzle-plugin-logger');
      should(options.plugins).not.have.keys('kuzzle-plugin-auth-passport-local');
    });
  });

  describe('PipeManager#register', () => {
    it('should registers a new pipe', () => {
      const handler = async () => {};
      const handler_bis = async () => {};

      application.pipe.register('kuzzle:state:ready', handler);
      application.pipe.register('kuzzle:state:ready', handler_bis);

      should(application._pipes['kuzzle:state:ready']).have.length(2);
      should(application._pipes['kuzzle:state:ready'][0]).be.eql(handler);
      should(application._pipes['kuzzle:state:ready'][1]).be.eql(handler_bis);
    });

    it('should throw an error if the pipe handler is invalid', () => {
      should(() => {
        application.pipe.register('kuzzle:state:ready', {});
      }).throwError({ id: 'plugin.assert.invalid_pipe' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.pipe.register('kuzzle:state:ready', async () => {});
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('HookManager#register', () => {
    it('should registers a new hook', () => {
      const handler = async () => {};
      const handler_bis = async () => {};

      application.hook.register('kuzzle:state:ready', handler);
      application.hook.register('kuzzle:state:ready', handler_bis);

      should(application._hooks['kuzzle:state:ready']).have.length(2);
      should(application._hooks['kuzzle:state:ready'][0]).be.eql(handler);
      should(application._hooks['kuzzle:state:ready'][1]).be.eql(handler_bis);
    });

    it('should throw an error if the hook handler is invalid', () => {
      should(() => {
        application.hook.register('kuzzle:state:ready', {});
      }).throwError({ id: 'plugin.assert.invalid_hook' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.hook.register('kuzzle:state:ready', async () => {});
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('ConfigManager#set', () => {
    it('should allows to set a configuration value', () => {
      application.config.set('server.http.enabled', false);

      should(application.config.content.server.http.enabled).be.false();
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.config.set('server.http.enabled', false);
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('ConfigManager#merge', () => {
    it('should allows to merge configuration values', () => {
      application.config.merge({
        server: { http: { enabled: false } }
      });

      should(application.config.content.server.http.enabled).be.false();
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.config.merge({
          server: { http: { enabled: false } }
        });
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('ControllerManager#register', () => {
    const getDefinition = () => ({
      actions: {
        sayHello: {
          handler: async request => `Hello, ${request.input.args.name}`,
          http: [{ verb: 'POST', path: '/greeting/hello/:name' }]
        },
        sayBye: {
          handler: async request => `Bye ${request.input.args.name}!`,
        }
      }
    });
    let definition;

    beforeEach(() => {
      definition = getDefinition();
    });

    it('should registers a new controller definition', () => {
      application.controller.register('greeting', definition);

      should(application._controllers.greeting).not.be.undefined();
      should(application._controllers.greeting.actions.sayHello)
        .be.eql(definition.actions.sayHello);
    });

    it('should rejects if the controller definition is invalid', () => {
      definition.actions.sayHello.handler = {};

      should(() => {
        application.controller.register('greeting', definition);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });


      definition = getDefinition();
      definition.actions.sayHello.htto = [];

      should(() => {
        application.controller.register('greeting', definition);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });

      definition = getDefinition();
      definition.actions.sayHello.http = [{ verp: 'POST', path: '/url' }];

      should(() => {
        application.controller.register('greeting', definition);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });

    it('should rejects if the name is already taken', () => {
      application.controller.register('greeting', definition);

      should(() => {
        application.controller.register('greeting', definition);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });
  });

  describe('ControllerManager#use', () => {
    class GreetingController {
      constructor () {
        this.definition = {
          actions: {
            sayHello: {
              handler: this.sayHello
            },
          }
        };
      }

      async sayHello () {}
    }

    let controller;

    beforeEach(() => {
      controller = new GreetingController();
    });

    it('should uses a new controller instance', () => {
      application.controller.use(controller);

      should(application._controllers.greeting).not.be.undefined();
      should(application._controllers.greeting.actions.sayHello.handler.name)
        .be.eql('bound sayHello');
    });

    it('should uses the name property for controller name', () => {
      controller.name = 'bonjour';
      application.controller.use(controller);

      should(application._controllers.bonjour).not.be.undefined();
    });

    it('should rejects if the controller instance is invalid', () => {
      controller.definition.actions.sayHello.handler = {};

      should(() => {
        application.controller.use(controller);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });

    it('should rejects if the name is already taken', () => {
      application.controller.use(controller);
      const controller2 = new GreetingController();

      should(() => {
        application.controller.use(controller2);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });
  });

  describe('VaultManager#key', () => {
    it('should sets the vault key', () => {
      application.vault.key = 'unforeseen-consequences';

      should(application._vaultKey).be.eql('unforeseen-consequences');
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.key = 'unforeseen-consequences';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('VaultManager#file', () => {
    it('should sets the vault file', () => {
      application.vault.file = 'xen.bmp';

      should(application._secretsFile).be.eql('xen.bmp');
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.file = 'xen.bmp';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('VaultManager.secrets', () => {
    it('should exposes Kuzzle vault secrets', () => {
      application.started = true;
      _.set(application, '_kuzzle.vault.secrets', { beware: 'vortigaunt' });

      should(application.vault.secrets).be.eql({ beware: 'vortigaunt' });
    });

    it('should throw an error if the application is not started', () => {
      should(() => {
        /* eslint-disable-next-line no-unused-expressions */
        application.vault.secrets;
      }).throwError({ id: 'plugin.runtime.unavailable_before_start' });
    });
  });

  describe('PluginManager#use', () => {
    class DummyPlugin {
      constructor () {}
      init () {}
    }
    class WrongPlugin {
      constructor () {}
    }

    it('should allows to use a plugin and infer the name', () => {
      const plugin = new DummyPlugin();

      application.plugin.use(plugin);

      should(application._plugins['dummy-plugin'])
        .be.eql({ plugin, options: {} });
    });

    it('should allows to specify the plugin name and options', () => {
      const plugin = new DummyPlugin();

      application.plugin.use(
        plugin,
        { name: 'not-dummy', manifest: 'manifest' });

      should(application._plugins['not-dummy'])
        .be.eql({ plugin, options: { name: 'not-dummy', manifest: 'manifest' } });
    });

    it('should throw an error if the plugin is invalid', () => {
      should(() => {
        application.plugin.use({ init: () => {} });
      }).throwError({ id: 'plugin.assert.no_name_provided' });

      should(() => {
        application.plugin.use(new DummyPlugin(), { name: 'DummyPlugin' });
      }).throwError({ id: 'plugin.assert.invalid_plugin_name' });

      should(() => {
        application.plugin.use(new DummyPlugin());
        application.plugin.use(new DummyPlugin());
      }).throwError({ id: 'plugin.assert.name_already_exists' });

      should(() => {
        application.plugin.use(new WrongPlugin());
      }).throwError({ id: 'plugin.assert.init_not_found' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.file = 'xen.bmp';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('Logger', () => {
    describe('#_log', () => {
      it('should exposes log methods and call kuzzle ones', async () => {
        await application.start();

        application.log.debug('debug');
        application.log.info('info');
        application.log.warn('warn');
        application.log.error('error');
        application.log.verbose({ info: 'verbose' });

        should(global.kuzzle.log.debug).be.calledWith(util.inspect('debug'));
        should(global.kuzzle.log.info).be.calledWith(util.inspect('info'));
        should(global.kuzzle.log.warn).be.calledWith(util.inspect('warn'));
        should(global.kuzzle.log.error).be.calledWith(util.inspect('error'));
        should(global.kuzzle.log.verbose).be.calledWith(util.inspect({ info: 'verbose' }));
      });
    });
  });

  it('should exposes kerror', () => {
    should(application.kerror.get).be.a.Function();
    should(application.kerror.reject).be.a.Function();
    should(application.kerror.getFrom).be.a.Function();
    should(application.kerror.rejectFrom).be.a.Function();
    should(application.kerror.wrap).be.a.Function();
  });

  describe('#trigger', () => {
    it('should exposes the trigger method', async () => {
      await application.start();

      global.kuzzle.pipe.resolves('resonance cascade');

      const result = await application.trigger('xen:crystal', 'payload');

      should(global.kuzzle.pipe).be.calledWith('xen:crystal', 'payload');
      should(result).be.eql('resonance cascade');
    });

    it('should throw an error if the application is not started', () => {
      return should(() => {
        application.trigger('xen:crystal', 'payload');
      })
        .throwError({ id: 'plugin.runtime.unavailable_before_start' });
    });
  });

  describe('StorageManager#StorageClient', () => {
    it('should allows to construct an ES StorageClient', async () => {
      await application.start();
      global.kuzzle.config.services.storageEngine.client.node = 'http://es:9200';
      should(application.storage.StorageClient).be.a.Function();

      const client = new application.storage.StorageClient({ maxRetries: 42 });
      should(client).be.instanceOf(ElasticsearchClient);
      should(client.connectionPool.connections[0].url.toString()).be.eql('http://es:9200/');
      should(client.helpers.maxRetries).be.eql(42);
    });
  });

  describe('StorageManager#storageClient', () => {
    it('should allows lazily access an ES Client', async () => {
      await application.start();

      global.kuzzle.config.services.storageEngine.client.node = 'http://es:9200';
      should(application.storage._client).be.null();

      should(application.storage.storageClient).be.instanceOf(ElasticsearchClient);
      should(application.storage.storageClient.connectionPool.connections[0].url.toString())
        .be.eql('http://es:9200/');
    });
  });
});
