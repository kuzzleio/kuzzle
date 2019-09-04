'use strict';

const root = '../../../../';

const
  mockrequire = require('mock-require'),
  should = require('should'),
  ElasticsearchClientMock = require(`${root}/test/mocks/services/elasticsearchClient.mock`),
  KuzzleMock = require(`${root}/test/mocks/kuzzle.mock`),
  sinon = require('sinon'),
  {
    Request,
    errors: {
      KuzzleError,
      GatewayTimeoutError,
      PluginImplementationError
    }
  } = require('kuzzle-common-objects');

describe('PluginsManager.run', () => {
  let
    plugin,
    pluginMock,
    kuzzle,
    PluginsManager,
    pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire(`${root}/lib/api/core/plugins/pluginContext`);
    mockrequire.reRequire(`${root}/lib/api/core/plugins/privilegedPluginContext`);
    PluginsManager = mockrequire.reRequire(`${root}/lib/api/core/plugins/pluginsManager`);

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

  describe('#hook', () => {
    it('should attach event hook with method name', () => {
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

    it('should attach event hook with function', () => {
      const
        bar = sinon.spy(),
        foo = sinon.spy();

      plugin.object.hooks = {
        'foo:bar': bar,
        'bar:foo': foo
      };

      return pluginsManager.run()
        .then(() => {
          kuzzle.emit('foo:bar');

          should(bar).be.calledOnce();
          should(foo).not.be.called();
        });
    });

    it('should attach multi-target hook with method name', () => {
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

    it('should attach multi-target hook with function', () => {
      const
        bar = sinon.spy(),
        foo = sinon.spy(),
        baz = sinon.spy();

      plugin.object.hooks = {
        'foo:bar': [foo, bar],
        'bar:foo': [baz]
      };

      return pluginsManager.run()
        .then(() => {
          kuzzle.emit('foo:bar');

          should(bar).be.calledOnce();
          should(foo).be.calledOnce();
          should(baz).not.be.called();
        });
    });

    it('should attach event hook with wildcard with method name', () => {
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

    it('should throw if a hook target is not a function and not a method name', () => {
      plugin.object.hooks = {
        'foo:bar': 'fou'
      };

      plugin.object.foo = () => {};

      return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "foo"/ });
    });
  });

  describe('#pipe', () => {
    beforeEach(() => {
      kuzzle.pipe.restore();
      kuzzle.pluginsManager = pluginsManager;
    });

    it('should attach pipes event with method name', () => {
      plugin.object.pipes = {
        'foo:bar': 'foo',
        'bar:foo': 'bar'
      };

      plugin.object.foo = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.bar = sinon.stub().callsArgWith(1, null, new Request({}));

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => {
          should(plugin.object.foo).be.calledOnce();
          should(plugin.object.bar).not.be.called();
        });
    });

    it('should attach pipes event with function', () => {
      const
        bar = sinon.stub().callsArgWith(1, null, new Request({})),
        foo = sinon.stub().callsArgWith(1, null, new Request({}));

      plugin.object.pipes = {
        'foo:bar': foo,
        'bar:foo': bar
      };

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => {
          should(foo).be.calledOnce();
          should(bar).not.be.called();
        });
    });

    it('should attach pipes event with wildcard with method name', () => {
      plugin.object.pipes = {
        'foo:*': 'foo',
        'bar:foo': 'bar'
      };

      plugin.object.foo = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.bar = sinon.stub().callsArgWith(1, null, new Request({}));

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => {
          should(plugin.object.foo).be.calledOnce();
          should(plugin.object.bar).not.be.called();
        });
    });

    it('should attach multi-target event to pipes with method name', () => {
      plugin.object.pipes = {
        'foo:bar': ['foo', 'baz'],
        'bar:foo': ['bar']
      };

      plugin.object.foo = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.bar = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.baz = sinon.stub().callsArgWith(1, null, new Request({}));

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => {
          should(plugin.object.foo).be.calledOnce();
          should(plugin.object.bar).not.be.called();
          should(plugin.object.baz).be.calledOnce();
        });
    });

    it('should attach multi-target event to pipes with function', () => {
      const
        bar = sinon.stub().callsArgWith(1, null, new Request({})),
        foo = sinon.stub().callsArgWith(1, null, new Request({})),
        baz = sinon.stub().callsArgWith(1, null, new Request({}));

      plugin.object.pipes = {
        'foo:bar': [foo, baz],
        'bar:foo': [bar]
      };

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => {
          should(foo).be.calledOnce();
          should(baz).be.calledOnce();
          should(bar).not.be.called();
        });
    });

    it('should throw if a pipe target is not a function and not a method name', () => {
      plugin.object.pipes = {
        'foo:bar': 'fou'
      };

      plugin.object.foo = () => {};

      return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "foo"/ });
    });

    it('should attach pipes event and reject if an attached function return an error', () => {
      plugin.object.pipes = {
        'foo:bar': 'foo'
      };

      plugin.object.foo = sinon.stub()
        .callsArgWith(1, new KuzzleError('foobar'));


      return should(pluginsManager.run().then(() => kuzzle.pipe('foo:bar')))
        .be.rejectedWith(KuzzleError, {message: 'foobar'});
    });

    it('should embed a non-KuzzleError error in a PluginImplementationError', () => {
      plugin.object.pipes = {
        'foo:bar': 'foo'
      };

      plugin.object.foo = () => {};

      pluginMock.expects('foo').once().callsArgWith(1, 'foobar');

      return should(pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => pluginMock.verify()))
        .be.rejectedWith(
          PluginImplementationError,
          {message: new PluginImplementationError('foobar.').message});
    });

    it('should log a warning in case a pipe plugin exceeds the warning delay', () => {
      plugin.object.pipes = {
        'foo:bar': 'foo'
      };

      plugin.object.foo = () => {};

      const warnTime = kuzzle.config.plugins.common.pipeWarnTime;
      kuzzle.config.plugins.common.pipeWarnTime = 10;

      const fooStub = sinon.stub(plugin.object, 'foo').callsFake((ev, cb) => {
        setTimeout(() => cb(null, new Request({})), 11);
      });

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() => {
          should(fooStub).be.calledOnce();
          should(kuzzle.log.warn)
            .calledWithMatch(/Plugin pipe .*? exceeded [0-9]*ms to execute\./);

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
        .then(() => kuzzle.pipe('foo:bar'))
        .then(() =>{
          throw new Error('expected this promise to be rejected');
        })
        .catch(error => {
          kuzzle.config.plugins.common.pipeTimeout = timeout;
          should(error).be.an.instanceOf(GatewayTimeoutError);
        });
    });

    it('should accept promises for pipes', () => {
      plugin.object.pipes = {
        'foo:bar': 'foo'
      };
      const request = new Request({});

      plugin.object.foo = sinon.stub().resolves(request);

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(response => {
          should(plugin.object.foo).be.calledOnce();
          should(response.internalId).eql(request.internalId);
        });
    });

    it('should accept promises that resolve to anything for pipes', () => {
      plugin.object.pipes = {
        'foo:bar': 'foo'
      };

      plugin.object.foo = sinon.stub().resolves({ result: 'flavie' });

      return pluginsManager.run()
        .then(() => kuzzle.pipe('foo:bar'))
        .then(response => {
          should(plugin.object.foo).be.calledOnce();
          should(response.result).eql('flavie');
        });
    });
  });

  describe('#controller', () => {
    it('should attach controller actions with method name', () => {
      plugin.object.controllers = {
        'foo': {
          'actionName': 'functionName'
        }
      };

      plugin.object.functionName = () => {};

      return pluginsManager.run()
        .then(() => {
          should(pluginsManager.controllers['testPlugin/foo']).be.an.Object();
          should(pluginsManager.controllers['testPlugin/foo'].actionName)
            .be.eql(plugin.object.functionName.bind(plugin.object));
        });
    });

    it('should attach controller actions with function', () => {
      const action = sinon.spy();

      plugin.object.controllers = {
        'foo': {
          'actionName': action
        }
      };

      plugin.object.functionName = () => {};

      return pluginsManager.run()
        .then(() => {
          should(pluginsManager.controllers['testPlugin/foo']).be.an.Object();
          should(pluginsManager.controllers['testPlugin/foo'].actionName).be.eql(action);
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
          'anotherActionName': 'fou'
        }
      };

      plugin.object.functionName = () => {};
      plugin.object.foo = () => {};

      should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "foo"/ });
    });

    it('should not add an invalid route to the API', () => {
      plugin.object.controllers = {
        'foo': {
          'bar': 'functionName'
        }
      };

      plugin.object.functionName = () => {};

      plugin.object.routes = [
        {vert: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'}
      ];
      return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "verb"/ })
        .then(() => {
          plugin.object.routes = [
            {verb: 'post', url: ['/bar'], controller: 'foo', action: 'bar'}
          ];

          return should(pluginsManager.run()).be.rejectedWith(PluginImplementationError);
        })
        .then(() => {
          plugin.object.routes = [
            {verb: 'posk', url: '/bar', controller: 'foo', action: 'bar'}
          ];

          return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "post"/ });
        })
        .then(() => {
          plugin.object.routes = [
            {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'baz'}
          ];

          return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "bar"/ });
        })
        .then(() => {
          plugin.object.routes = [
            {verb: 'get', url: '/bar/:name', controller: 'fou', action: 'bar'}
          ];

          return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "foo"/ });
        })
        .then(() => {
          plugin.object.routes = [
            { verb: 'get', url: '/bar/:name', controler: 'foo', action: 'bar' }
          ];

          return should(pluginsManager.run()).be.rejectedWith({ message: /Did you mean "controller"/ });
        });
    });
  });
});
