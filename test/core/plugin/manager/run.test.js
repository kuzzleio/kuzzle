'use strict';

const root = '../../../../';

const mockrequire = require('mock-require');
const should = require('should');
const ElasticsearchClientMock = require(`${root}/test/mocks/service/elasticsearchClient.mock`);
const KuzzleMock = require(`${root}/test/mocks/kuzzle.mock`);
const sinon = require('sinon');
const {
  Request,
  errors: {
    KuzzleError,
    PluginImplementationError,
  }
} = require('kuzzle-common-objects');
const { BaseController } = require(`${root}/lib/api/controller/base`);

describe('PluginsManager.run', () => {
  let plugin;
  let pluginMock;
  let kuzzle;
  let PluginsManager;
  let pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire(`${root}/lib/core/plugin/context`);
    mockrequire.reRequire(`${root}/lib/core/plugin/privilegedContext`);
    PluginsManager = mockrequire.reRequire(`${root}/lib/core/plugin/manager`);

    pluginsManager = new PluginsManager(kuzzle);

    plugin = {
      path: '',
      object: {
        init: () => {},
      },
      config: {},
      manifest: {
        name: 'testPlugin',
        path: '',
      }
    };

    pluginMock = sinon.mock(plugin.object);
    pluginsManager.plugins = {testPlugin: plugin};
  });

  describe('#hook', () => {
    it('should attach event hook with method name', async () => {
      plugin.object.hooks = {
        'foo:bar': 'foo',
        'bar:foo': 'bar',
      };

      plugin.object.foo = () => {};
      plugin.object.bar = () => {};

      pluginMock.expects('foo').once();
      pluginMock.expects('bar').never();

      await pluginsManager.run();
      kuzzle.emit('foo:bar');
      pluginMock.verify();
    });

    it('should attach event hook with function', async () => {
      const bar = sinon.spy();
      const foo = sinon.spy();

      plugin.object.hooks = {
        'foo:bar': bar,
        'bar:foo': foo,
      };

      await pluginsManager.run();
      kuzzle.emit('foo:bar');

      should(bar).be.calledOnce();
      should(foo).not.be.called();
    });

    it('should attach multi-target hook with method name', async () => {
      plugin.object.hooks = {
        'foo:bar': ['foo', 'bar'],
        'bar:foo': ['baz'],
      };

      plugin.object.foo = () => {};
      plugin.object.bar = () => {};
      plugin.object.baz = () => {};

      pluginMock.expects('foo').once();
      pluginMock.expects('bar').once();
      pluginMock.expects('baz').never();

      await pluginsManager.run();

      kuzzle.emit('foo:bar');

      pluginMock.verify();
    });

    it('should attach multi-target hook with function', async () => {
      const bar = sinon.spy();
      const foo = sinon.spy();
      const baz = sinon.spy();

      plugin.object.hooks = {
        'foo:bar': [foo, bar],
        'bar:foo': [baz],
      };

      await pluginsManager.run();

      kuzzle.emit('foo:bar');

      should(bar).be.calledOnce();
      should(foo).be.calledOnce();
      should(baz).not.be.called();
    });

    it('should attach event hook with wildcard with method name', async () => {
      plugin.object.hooks = {
        'foo:*': 'foo',
        'bar:foo': 'bar',
      };

      plugin.object.foo = () => {};
      plugin.object.bar = () => {};

      pluginMock.expects('foo').once();
      pluginMock.expects('bar').never();

      await pluginsManager.run();

      kuzzle.emit('foo:bar');
      pluginMock.verify();
    });

    it('should throw if a hook target is not a function and not a method name', () => {
      plugin.object.hooks = {
        'foo:bar': 'fou',
      };

      plugin.object.foo = () => {};

      return should(pluginsManager.run())
        .be.rejectedWith({ message: /Did you mean "foo"/ });
    });
  });

  describe('#pipe', () => {
    beforeEach(() => {
      kuzzle.pipe.restore();
      kuzzle.pluginsManager = pluginsManager;
    });

    it('should attach pipes event with method name', async () => {
      plugin.object.pipes = {
        'foo:bar': 'foo',
        'bar:foo': 'bar',
      };

      plugin.object.foo = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.bar = sinon.stub().callsArgWith(1, null, new Request({}));

      await pluginsManager.run();
      await kuzzle.pipe('foo:bar');

      should(plugin.object.foo).be.calledOnce();
      should(plugin.object.bar).not.be.called();
    });

    it('should attach pipes event with function', async () => {
      const bar = sinon.stub().callsArgWith(1, null, new Request({}));
      const foo = sinon.stub().callsArgWith(1, null, new Request({}));

      plugin.object.pipes = {
        'foo:bar': foo,
        'bar:foo': bar,
      };

      await pluginsManager.run();
      await kuzzle.pipe('foo:bar');

      should(foo).be.calledOnce();
      should(bar).not.be.called();
    });

    it('should attach pipes event with wildcard with method name', async () => {
      plugin.object.pipes = {
        'foo:*': 'foo',
        'bar:foo': 'bar',
      };

      plugin.object.foo = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.bar = sinon.stub().callsArgWith(1, null, new Request({}));

      await pluginsManager.run();
      await kuzzle.pipe('foo:bar');

      should(plugin.object.foo).be.calledOnce();
      should(plugin.object.bar).not.be.called();
    });

    it('should attach multi-target event to pipes with method name', async () => {
      plugin.object.pipes = {
        'foo:bar': ['foo', 'baz'],
        'bar:foo': ['bar'],
      };

      plugin.object.foo = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.bar = sinon.stub().callsArgWith(1, null, new Request({}));
      plugin.object.baz = sinon.stub().callsArgWith(1, null, new Request({}));

      await pluginsManager.run();
      await kuzzle.pipe('foo:bar');

      should(plugin.object.foo).be.calledOnce();
      should(plugin.object.bar).not.be.called();
      should(plugin.object.baz).be.calledOnce();
    });

    it('should attach multi-target event to pipes with function', () => {
      const bar = sinon.stub().callsArgWith(1, null, new Request({}));
      const foo = sinon.stub().callsArgWith(1, null, new Request({}));
      const baz = sinon.stub().callsArgWith(1, null, new Request({}));

      plugin.object.pipes = {
        'foo:bar': [foo, baz],
        'bar:foo': [bar],
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
          { id: 'plugin.runtime.unexpected_error' });
    });

    it('should log a warning in case a pipe plugin exceeds the warning delay', async () => {
      plugin.object.pipes = {
        'foo:bar': 'foo',
      };

      plugin.object.foo = () => {};

      const warnTime = kuzzle.config.plugins.common.pipeWarnTime;
      kuzzle.config.plugins.common.pipeWarnTime = 10;

      const fooStub = sinon.stub(plugin.object, 'foo').callsFake((ev, cb) => {
        setTimeout(() => cb(null, new Request({})), 11);
      });

      await pluginsManager.run();
      await kuzzle.pipe('foo:bar');

      should(fooStub).be.calledOnce();
      should(kuzzle.log.warn)
        .calledWithMatch(/\[testPlugin\] pipe for event 'foo:bar' is slow \(\d+ms\)/);

      kuzzle.config.plugins.common.pipeWarnTime = warnTime;
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
          should(pluginsManager.controllers.get('testPlugin/foo'))
            .be.instanceof(BaseController);
          should(pluginsManager.controllers.get('testPlugin/foo').actionName)
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
          should(pluginsManager.controllers.get('testPlugin/foo'))
            .be.instanceof(BaseController);
          should(pluginsManager.controllers.get('testPlugin/foo').actionName)
            .be.eql(action);
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

      return should(pluginsManager.run()).be.rejected();
    });

    it('should abort the plugin initialization if one of the controller action is not correctly defined', () => {
      plugin.object.controllers = {
        'foo': {
          'actionName': []
        }
      };

      return should(pluginsManager.run()).be.rejected();
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

      return should(pluginsManager.run())
        .be.rejectedWith({ message: /Did you mean "foo"/ });
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
