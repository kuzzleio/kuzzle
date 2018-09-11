'use strict';

const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  {
    KuzzleError,
    GatewayTimeoutError,
    PluginImplementationError
  } = require('kuzzle-common-objects').errors,
  PluginsManager = require('../../../../lib/api/core/plugins/pluginsManager');

describe.only('PluginsManager.run', () => {
  let
    plugin,
    pluginMock,
    kuzzle,
    pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    pluginsManager = new PluginsManager(kuzzle);

    plugin = {
      path: '',
      object: {
        init: () => {}
      },
      config: {},
      manifest: {
        name: 'testPlugin',
        path: ''
      }
    };

    pluginMock = sinon.mock(plugin.object);
    pluginsManager.plugins = {testPlugin: plugin};
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
    const spy = sinon.spy(kuzzle, 'emit');

    plugin.object.pipes = {
      'foo:bar': 'foo'
    };

    plugin.object.foo = () => {};

    const warnTime = kuzzle.config.plugins.common.pipeWarnTime;
    kuzzle.config.plugins.common.pipeWarnTime = 10;

    const fooStub = sinon.stub(plugin.object, 'foo').callsFake(function (ev, cb) {
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
      {verb: 'head', url: '/bar/:name', controller: 'foo', action: 'bar'},
      {verb: 'post', url: '/bar', controller: 'foo', action: 'bar'},
      {verb: 'put', url: '/bar', controller: 'foo', action: 'bar'},
      {verb: 'delete', url: '/bar', controller: 'foo', action: 'bar'},
      {verb: 'patch', url: '/bar', controller: 'foo', action: 'bar'}
    ];

    plugin.object.controllers = {
      'foo': {
        'bar': 'functionName'
      }
    };

    plugin.object.functionName = () => {};

    return pluginsManager.run()
      .then(() => {
        should(pluginsManager.routes).be.an.Array().and.length(6);

        should(pluginsManager.routes[0].verb).be.equal('get');
        should(pluginsManager.routes[0].url).be.equal('/testPlugin/bar/:name');
        should(pluginsManager.routes[0].controller).be.equal('testPlugin/foo');
        should(pluginsManager.routes[0].action).be.equal('bar');

        should(pluginsManager.routes[1].verb).be.equal('head');
        should(pluginsManager.routes[1].url).be.equal('/testPlugin/bar/:name');
        should(pluginsManager.routes[1].controller).be.equal('testPlugin/foo');
        should(pluginsManager.routes[1].action).be.equal('bar');

        should(pluginsManager.routes[2].verb).be.equal('post');
        should(pluginsManager.routes[2].url).be.equal('/testPlugin/bar');
        should(pluginsManager.routes[2].controller).be.equal('testPlugin/foo');
        should(pluginsManager.routes[2].action).be.equal('bar');

        should(pluginsManager.routes[3].verb).be.equal('put');
        should(pluginsManager.routes[3].url).be.equal('/testPlugin/bar');
        should(pluginsManager.routes[3].controller).be.equal('testPlugin/foo');
        should(pluginsManager.routes[3].action).be.equal('bar');

        should(pluginsManager.routes[4].verb).be.equal('delete');
        should(pluginsManager.routes[4].url).be.equal('/testPlugin/bar');
        should(pluginsManager.routes[4].controller).be.equal('testPlugin/foo');
        should(pluginsManager.routes[4].action).be.equal('bar');

        should(pluginsManager.routes[5].verb).be.equal('patch');
        should(pluginsManager.routes[5].url).be.equal('/testPlugin/bar');
        should(pluginsManager.routes[5].controller).be.equal('testPlugin/foo');
        should(pluginsManager.routes[5].action).be.equal('bar');
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
    plugin.object.controllers = {
      'foo': {
        'bar': 'functionName'
      }
    };

    plugin.object.functionName = () => {};

    plugin.object.routes = [
      {invalid: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'}
    ];
    should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);

    plugin.object.routes = [
      {verb: 'post', url: ['/bar'], controller: 'foo', action: 'bar'}
    ];
    should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);

    plugin.object.routes = [
      {verb: 'invalid', url: '/bar', controller: 'foo', action: 'bar'}
    ];
    should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);

    plugin.object.routes = [
      {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'invalid'}
    ];
    should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);

    plugin.object.routes = [
      {verb: 'get', url: '/bar/:name', controller: 'invalid', action: 'bar'}
    ];
    should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);

  });
});
