'use strict';

const should = require('should');

const { Backend} = require('../../../lib/core/backend');

describe('BackendPlugin', () => {
  let application;

  beforeEach(() => {
    application = new Backend('black-mesa');
  });

  describe('#use', () => {
    class DummyPlugin {
      constructor () {}
      init () {}
    }
    class WrongPlugin {
      constructor () {}
    }

    it('should allow to use a plugin and infer the name', () => {
      const plugin = new DummyPlugin();

      application.plugin.use(plugin);

      should(application._plugins).has.property('dummy');
      should(application._plugins.dummy)
        .be.eql({ plugin, options: {} });
    });

    it('should allow to specify the plugin\'s name and options', () => {
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
  });
});
