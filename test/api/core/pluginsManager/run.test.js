'use strict';

const
  should = require('should'),
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  /** @type {Params} */
  params = require('../../../../lib/config'),
  sinon = require('sinon'),
  EventEmitter = require('eventemitter2').EventEmitter2,
  {
    KuzzleError,
    GatewayTimeoutError,
    PluginImplementationError
  } = require('kuzzle-common-objects').errors;

describe('Test plugins manager run', () => {
  let
    PluginsManager,
    sandbox,
    plugin,
    pluginMock,
    kuzzle,
    pluginsManager;

  before(() => {
    PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');
    
    // making it quiet
    PluginsManager.__set__({
      console: {
        log: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub()
      }
    });
  });

  beforeEach(() => {
    kuzzle = new EventEmitter({
      verboseMemoryLeak: true,
      wildcard: true,
      maxListeners: 30,
      delimiter: ':'
    });
    kuzzle.config = { plugins: params.plugins };

    pluginsManager = new PluginsManager(kuzzle);
    sandbox = sinon.sandbox.create();

    plugin = {
      name: 'testPlugin',
      path: '',
      object: {
        init: () => {}
      },
      config: {},
      manifest: {}
    };

    pluginMock = sandbox.mock(plugin.object);
    pluginsManager.plugins = {testPlugin: plugin};
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    mockrequire.stopAll();
  });

  it('should attach event hook on kuzzle object', () => {
    plugin.object.hooks = {
      'foo:bar': 'foo',
      'bar:foo': 'bar'
    };

    plugin.object.foo = () => {};
    plugin.object.bar = () => {};

    pluginMock.expects('foo').once();
    pluginMock.expects('bar').never();

    return pluginsManager.run()
      .then(() => {
        kuzzle.emit('foo:bar');
        pluginMock.verify();
      });
  });

  it('should attach multi-target hook on kuzzle object', () => {
    plugin.object.hooks = {
      'foo:bar': ['foo', 'bar'],
      'bar:foo': ['baz']
    };

    plugin.object.foo = () => {};
    plugin.object.bar = () => {};
    plugin.object.baz = () => {};

    pluginMock.expects('foo').once();
    pluginMock.expects('bar').once();
    pluginMock.expects('baz').never();

    return pluginsManager.run()
      .then(() => {
        kuzzle.emit('foo:bar');
        pluginMock.verify();
      });
  });

  it('should attach event hook with wildcard on kuzzle object', () => {
    plugin.object.hooks = {
      'foo:*': 'foo',
      'bar:foo': 'bar'
    };

    plugin.object.foo = () => {};
    plugin.object.bar = () => {};

    pluginMock.expects('foo').once();
    pluginMock.expects('bar').never();

    return pluginsManager.run()
      .then(() => {
        kuzzle.emit('foo:bar');
        pluginMock.verify();
      });
  });

  it('should throw if a hook target does not exist', () => {
    plugin.object.hooks = {
      'foo:bar': 'foo'
    };

    return should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);
  });

  it('should attach pipes event', () => {
    plugin.object.pipes = {
      'foo:bar': 'foo',
      'bar:foo': 'bar'
    };

    plugin.object.foo = () => {};
    plugin.object.bar = () => {};

    pluginMock.expects('foo').once().callsArg(1);
    pluginMock.expects('bar').never().callsArg(1);

    return pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => pluginMock.verify());
  });

  it('should attach pipes event with wildcard', () => {
    plugin.object.pipes = {
      'foo:*': 'foo',
      'bar:foo': 'bar'
    };

    plugin.object.foo = () => {};
    plugin.object.bar = () => {};

    pluginMock.expects('foo').once().callsArg(1);
    pluginMock.expects('bar').never().callsArg(1);

    return pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => pluginMock.verify());
  });

  it('should attach multi-function event to pipes', () => {
    plugin.object.pipes = {
      'foo:bar': ['foo', 'baz'],
      'bar:foo': 'bar'
    };

    plugin.object.foo = () => {};
    plugin.object.bar = () => {};
    plugin.object.baz = () => {};

    pluginMock.expects('foo').once().callsArg(1);
    pluginMock.expects('bar').never().callsArg(1);
    pluginMock.expects('baz').once().callsArg(1);

    return pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => pluginMock.verify());
  });

  it('should throw if a pipe target does not exist', () => {
    plugin.object.pipes = {
      'foo:bar': 'foo'
    };

    return should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);
  });

  it('should attach pipes event and reject if an attached function return an error', () => {
    plugin.object.pipes = {
      'foo:bar': 'foo'
    };

    plugin.object.foo = () => {};

    pluginMock.expects('foo').once().callsArgWith(1, new KuzzleError('foobar'));

    return should(pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => pluginMock.verify())).be.rejectedWith(KuzzleError, {message: 'foobar'});
  });

  it('should embed a non-KuzzleError error in a PluginImplementationError', () => {
    plugin.object.pipes = {
      'foo:bar': 'foo'
    };

    plugin.object.foo = () => {};

    pluginMock.expects('foo').once().callsArgWith(1, 'foobar');

    return should(pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => pluginMock.verify())).be.rejectedWith(PluginImplementationError, {message: new PluginImplementationError('foobar').message});
  });

  it('should log a warning in case a pipe plugin exceeds the warning delay', () => {
    let
      spy = sandbox.spy(kuzzle, 'emit'),
      fooStub;

    plugin.object.pipes = {
      'foo:bar': 'foo'
    };

    plugin.object.foo = () => {};

    const warnTime = kuzzle.config.plugins.common.pipeWarnTime;
    kuzzle.config.plugins.common.pipeWarnTime = 10;

    fooStub = sandbox.stub(plugin.object, 'foo').callsFake(function (ev, cb) {
      setTimeout(() => cb(), 11);
    });

    return pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => {
        should(fooStub)
          .be.calledOnce();
        should(spy)
          .be.calledWithMatch('log:warn', /Plugin pipe .*? exceeded [0-9]*ms to execute\./);

        kuzzle.config.plugins.common.pipeWarnTime = warnTime;
      });
  });

  it('should timeout the pipe when taking too long to execute', () => {
    plugin.object.pipes = {
      'foo:bar': 'foo'
    };

    plugin.object.foo = () => {}; // does not call the callback

    const timeout = kuzzle.config.plugins.common.pipeTimeout;
    kuzzle.config.plugins.common.pipeTimeout = 50;

    return pluginsManager.run()
      .then(() => pluginsManager.trigger('foo:bar'))
      .then(() => {
        throw new Error('should not happen');
      })
      .catch(error => {
        kuzzle.config.plugins.common.pipeTimeout = timeout;
        should(error).be.an.instanceOf(GatewayTimeoutError);
      });
  });

  it('should attach controller actions on kuzzle object', () => {
    plugin.object.controllers = {
      'foo': {
        'actionName': 'functionName'
      }
    };

    plugin.object.functionName = () => {};

    return pluginsManager.run()
      .then(() => {
        should(pluginsManager.controllers['testPlugin/foo']).be.an.Object();
        should(pluginsManager.controllers['testPlugin/foo'].actionName).be.eql(plugin.object.functionName.bind(plugin.object));
      });
  });

  it('should attach controller routes on kuzzle object', () => {
    plugin.object.routes = [
      {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'},
      {verb: 'post', url: '/bar', controller: 'foo', action: 'bar'}
    ];

    plugin.object.controllers = {
      'foo': {
        'bar': 'functionName'
      }
    };

    plugin.object.functionName = () => {};

    return pluginsManager.run()
      .then(() => {
        should(pluginsManager.routes).be.an.Array().and.length(2);
        should(pluginsManager.routes[0].verb).be.equal('get');
        should(pluginsManager.routes[0].url).be.equal('/testPlugin/bar/:name');
        should(pluginsManager.routes[1].verb).be.equal('post');
        should(pluginsManager.routes[1].url).be.equal('/testPlugin/bar');
        should(pluginsManager.routes[0].controller)
          .be.equal(pluginsManager.routes[0].controller)
          .and.be.equal('testPlugin/foo');
        should(pluginsManager.routes[0].action)
          .be.equal(pluginsManager.routes[0].action)
          .and.be.equal('bar');
      });
  });

  it('should abort the plugin initialization if the controller object is incorrectly defined', () => {
    plugin.object.controllers = {
      'foo': 'bar'
    };

    should(pluginsManager.run()).be.rejected();
  });

  it('should abort the plugin initialization if one of the controller action is not correctly defined', () => {
    plugin.object.controllers = {
      'foo': {
        'actionName': []
      }
    };

    should(pluginsManager.run()).be.rejected();
  });

  it('should abort the controller initialization if one of the controller action target does not exist', () => {
    plugin.object.controllers = {
      'foo': {
        'actionName': 'functionName',
        'anotherActionName': 'does not exist'
      }
    };

    plugin.object.functionName = () => {};

    should(pluginsManager.run()).be.rejected();
  });

  it('should not add an invalid route to the API', () => {
    plugin.object.routes = [
      {invalid: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'},
      {verb: 'post', url: ['/bar'], controller: 'foo', action: 'bar'},
      {verb: 'invalid', url: '/bar', controller: 'foo', action: 'bar'},
      {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'invalid'},
      {verb: 'get', url: '/bar/:name', controller: 'invalid', action: 'bar'},
    ];

    plugin.object.controllers = {
      'foo': {
        'bar': 'functionName'
      }
    };

    plugin.object.functionName = () => {};

    should(pluginsManager.run()).be.rejected();
  });
});
