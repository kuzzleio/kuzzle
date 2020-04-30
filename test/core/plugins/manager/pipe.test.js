'use strict';

const mockrequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const ElasticsearchClientMock = require('../../../mocks/services/elasticsearchClient.mock');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const {
  errors: {
    PluginImplementationError
  },
  Request
} = require('kuzzle-common-objects');

describe('pluginsManager.pipe', () => {
  let kuzzle;
  let pluginsManager;

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

  it('should reject a pipe properly if it throws', () => {
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

  it('should pass the correct number of arguments along the whole pipes chain', async () => {
    const
      fn = sinon.stub().callsArgWith(3, null, 'foo2'),
      fn2 = sinon.stub().callsArgWith(3, null, 'foo3');

    pluginsManager.plugins = [{
      object: {
        init: () => {},
        pipes: {
          'foo:bar': [fn, fn2]
        },
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    await pluginsManager.run();
    await kuzzle.pipe('foo:bar', 'foo', 'bar', 'baz');

    should(fn).calledOnce().calledWith('foo', 'bar', 'baz', sinon.match.func);
    should(fn2).calledOnce().calledWith('foo2', 'bar', 'baz', sinon.match.func);
  });
});
