const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  ElasticsearchClientMock = require('../../../mocks/services/elasticsearchClient.mock'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    errors: {
      PluginImplementationError
    },
    Request: KuzzleRequest
  } = require('kuzzle-common-objects');

describe('Test plugins manager trigger', () => {
  let pluginsManager;

  beforeEach(() => {
    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire('../../../../lib/services/internalEngine');
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');
    mockrequire.reRequire('../../../../lib/api/core/plugins/privilegedPluginContext');
    const PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

    pluginsManager = new PluginsManager(new KuzzleMock());
  });

  it('should trigger hooks with wildcard event', done => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: done
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:bar');
      });
  });

  it('should trigger hooks with before wildcard event', done => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        hooks: {
          'foo:before*': 'myFunc'
        },
        myFunc: done
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:beforeBar');
      });
  });

  it('should trigger hooks with after wildcard event', done => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        hooks: {
          'foo:after*': 'myFunc'
        },
        myFunc: done
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:afterBar');
      });
  });

  it('should trigger pipes with wildcard event', () => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        pipes: {
          'foo:*': 'myFunc'
        },
        myFunc: sinon.stub().callsArgWith(1, null, new KuzzleRequest({}))
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => {
        should(pluginsManager.plugins[0].object.myFunc).be.calledOnce();
      });
  });

  it('should trigger pipes with before wildcard event', () => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        pipes: {
          'foo:before*': 'myFunc'
        },
        myFunc: sinon.stub().callsArgWith(1, null, new KuzzleRequest({}))
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:beforeBar'))
      .then(() => {
        should(pluginsManager.plugins[0].object.myFunc).be.calledOnce();
      });
  });

  it('should trigger pipes with after wildcard event', () => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        pipes: {
          'foo:after*': 'myFunc'
        },
        myFunc: sinon.stub().callsArgWith(1, null, new KuzzleRequest({}))
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:afterBar'))
      .then(() => {
        should(pluginsManager.plugins[0].object.myFunc).be.calledOnce();
      });
  });

  it('should reject a pipe returned value if it is not a Request instance', () => {
    const pluginMock = {
      object: {
        init: () => {},
        pipes: {
          'foo:bar': 'myFunc'
        },
        myFunc: () => {
          throw new Error('foobar');
        }
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    };

    pluginsManager.object = [pluginMock];

    pluginsManager.registerPipe(pluginMock, 50, 200, 'foo:bar', 'myFunc');

    return should(pluginsManager.trigger('foo:bar')).rejectedWith(
      PluginImplementationError,
      {message: /^Plugin foo pipe for event 'foo:bar' threw a non-Kuzzle error: Error: foobar.*/});
  });
});
