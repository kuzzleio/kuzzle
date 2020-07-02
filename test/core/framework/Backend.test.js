'use strict';

const _ = require('lodash');
const should = require('should');
const sinon = require('sinon');

const { Backend } = require('../../../lib/core/framework/backend.ts');

describe('Backend', () => {
  let application;

  beforeEach(() => {
    application = new Backend('black-mesa');
  });

  describe('#instanceProxy', () => {
    it('should returns plugin definition and an init function', () => {
      application._pipes = 'pipes';
      application._hooks = 'hooks';
      application._controllers = 'controllers';

      const instance = application.instanceProxy;
      instance.init(null, 'context');

      should(instance.pipes).be.eql('pipes');
      should(instance.hooks).be.eql('hooks');
      should(instance.api).be.eql('controllers');

      should(application._context).be.eql('context');
    });
  });

  describe('#context', () => {
    it('should returns the application context', () => {
      application.started = true;
      application._context = 'context';

      should(application.context).be.eql('context');
    });

    it('should throws an error if the application is not started', () => {
      should(() => {
        /* eslint-disable-next-line no-unused-expressions */
        application.context;
      }).throwError({ id: 'plugin.runtime.unavailable_before_start' });
    });
  });

  describe('#sdk', () => {
    it('should returns the embedded sdk from context', () => {
      application.started = true;
      application._context = {
        accessors: { sdk: 'sdk' }
      };

      should(application.sdk).be.eql('sdk');
    });

    it('should throws an error if the application is not started', () => {
      should(() => {
        /* eslint-disable-next-line no-unused-expressions */
        application.sdk;
      }).throwError({ id: 'plugin.runtime.unavailable_before_start' });
    });
  });

  describe('#start', () => {
    it('should calls kuzzle.start with an instantiated plugin and options', async () => {
      application.kuzzle.start = sinon.stub();
      application.version = '42.21.84';
      application._vaultKey = 'vaultKey';
      application._secretsFile = 'secretsFile';
      application._plugins = 'plugins';
      application._support = {
        mappings: 'mappings',
        fixtures: 'fixtures',
        securities: 'securities',
      };

      await application.start();

      should(application.kuzzle.start).be.calledOnce();

      const [plugin, options] = application.kuzzle.start.getCall(0).args;

      should(plugin.application).be.true();
      should(plugin.name).be.eql('black-mesa');
      should(plugin.version).be.eql('42.21.84');
      should(plugin.instance).be.eql(application.instanceProxy);

      should(options.secretsFile).be.eql(application._secretsFile);
      should(options.vaultKey).be.eql(application._vaultKey);
      should(options.plugins).be.eql(application._plugins);
      should(options.mappings).be.eql(application._support.mappings);
      should(options.fixtures).be.eql(application._support.fixtures);
      should(options.securities).be.eql(application._support.securities);
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

    it('should throws an error if the pipe handler is invalid', () => {
      should(() => {
        application.pipe.register('kuzzle:state:ready', {});
      }).throwError({ id: 'plugin.assert.invalid_pipe' });
    });

    it('should throws an error if the application is already started', () => {
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

    it('should throws an error if the hook handler is invalid', () => {
      should(() => {
        application.hook.register('kuzzle:state:ready', {});
      }).throwError({ id: 'plugin.assert.invalid_hook' });
    });

    it('should throws an error if the application is already started', () => {
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

    it('should throws an error if the application is already started', () => {
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

    it('should throws an error if the application is already started', () => {
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
          http: [{ verb: 'POST', url: '/greeting/hello/:name' }]
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
      definition.actions.sayHello.http = [{ verp: 'POST', url: '/url' }];

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

    it('should generate default http routes if they are not provided', () => {
      application.controller.register('greeting', definition);

      should(application._controllers.greeting).not.be.undefined();
      should(application._controllers.greeting.actions.sayBye.http)
        .be.eql([
          { verb: 'POST', url: '/greeting/say-bye' }
        ]);
    });
  });

  describe('VaultManager#key', () => {
    it('should sets the vault key', () => {
      application.vault.key = 'unforeseen-consequences';

      should(application._vaultKey).be.eql('unforeseen-consequences');
    });

    it('should throws an error if the application is already started', () => {
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

    it('should throws an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.file = 'xen.bmp';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('VaultManager.secrets', () => {
    it('should exposes Kuzzle vault secrets', () => {
      application.started = true;
      _.set(application, 'kuzzle.vault.secrets', { beware: 'vortigaunt' });

      should(application.vault.secrets).be.eql({ beware: 'vortigaunt' });
    });

    it('should throws an error if the application is not started', () => {
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

      should(application._plugins['dummy-plugin']).be.eql(plugin);
    });

    it('should allows to specify the plugin name', () => {
      const plugin = new DummyPlugin();

      application.plugin.use(plugin, { name: 'not-dummy' });

      should(application._plugins['not-dummy']).be.eql(plugin);
    });

    it('should throws an error if the plugin is invalid', () => {
      should(() => {
        application.plugin.use({ init: () => {} });
      }).throwError({ id: 'plugin.assert.no_name_provided' });

      should(() => {
        application.plugin.use(new DummyPlugin(), { name: 'DummyPlugin' });
      }).throwError({ id: 'plugin.assert.invalid_application_name' });

      should(() => {
        application.plugin.use(new DummyPlugin());
        application.plugin.use(new DummyPlugin());
      }).throwError({ id: 'plugin.assert.name_already_exists' });

      should(() => {
        application.plugin.use(new WrongPlugin());
      }).throwError({ id: 'plugin.assert.init_not_found' });
    });

    it('should throws an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.file = 'xen.bmp';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });
});
