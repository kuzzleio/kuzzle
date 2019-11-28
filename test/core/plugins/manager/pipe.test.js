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
    Request
  } = require('kuzzle-common-objects');

describe('pluginsManager.pipe', () => {
  let
    kuzzle,
    pluginsManager;

  beforeEach(() => {
    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire('../../../../lib/core/plugins/context');
    mockrequire.reRequire('../../../../lib/core/plugins/privilegedContext');
    const PluginsManager = mockrequire.reRequire('../../../../lib/core/plugins/manager');

    kuzzle = new KuzzleMock();
    kuzzle.emit.restore();
    kuzzle.pipe.restore();
    pluginsManager = new PluginsManager(kuzzle);
    kuzzle.pluginsManager = pluginsManager;
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
        kuzzle.emit('foo:bar');
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
        kuzzle.emit('foo:beforeBar');
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
        kuzzle.emit('foo:afterBar');
      });
  });

  it('should trigger pipes with wildcard event', () => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        pipes: {
          'foo:*': 'myFunc'
        },
        myFunc: sinon.stub().callsArgWith(1, null, new Request({}))
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    return pluginsManager.run()
      .then(() => kuzzle.pipe('foo:bar'))
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
        myFunc: sinon.stub().callsArgWith(1, null, new Request({}))
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    return pluginsManager.run()
      .then(() => kuzzle.pipe('foo:beforeBar'))
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
        myFunc: sinon.stub().callsArgWith(1, null, new Request({}))
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    return pluginsManager.run()
      .then(() => kuzzle.pipe('foo:afterBar'))
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

    return should(kuzzle.pipe('foo:bar')).rejectedWith(
      PluginImplementationError,
      { id: 'plugin.runtime.unexpected_error' });
  });
});
