var
  should = require('should'),
  PluginsManager = require.main.require('lib/api/core/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2;

require('should-promised');

describe('Test plugins manager run', function () {

  it('should do nothing on run if plugin is not activated', function () {
    var
      pluginsManager = new PluginsManager ({}),
      isInitialized = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {
          isInitialized = true;
        }
      },
      activated: false
    }];

    pluginsManager.run();
    should(isInitialized).be.false();
  });

  it('should attach event hook on kuzzle object', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        hooks: {
          'test': 'myFunc'
        },
        myFunc: function () {
          done();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    kuzzle.emit('test');
  });

  it('should attach event hook with wildcard on kuzzle object', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: function () {
          done();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    kuzzle.emit('foo:bar');
  });

  it('should attach pipes event', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle),
      isCalled = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo': 'myFunc'
        },
        myFunc: function (object, callback) {
          isCalled = true;
          callback();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    pluginsManager.trigger('foo')
      .then(function () {
        should(isCalled).be.true();
        done();
      });
  });

  it('should attach pipes event with wildcard', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle),
      isCalled = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo:*': 'myFunc'
        },
        myFunc: function (object, callback) {
          isCalled = true;
          callback();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    pluginsManager.trigger('foo:bar')
      .then(function () {
        should(isCalled).be.true();
        done();
      });
  });

  it('should attach pipes event and reject if an attached function return an error', function () {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo:bar': 'myFunc'
        },
        myFunc: function (object, callback) {
          callback(true);
        }
      },
      activated: true
    }];

    pluginsManager.run();
    should(pluginsManager.trigger('foo:bar')).be.rejected();
  });

  it('should attach controller actions on kuzzle object', function (done) {
    var
      kuzzle = {},
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = {
      myplugin: {
        object: {
          init: function () {},
          controllers: {
            'foo': 'FooController'
          },
          FooController: function(context){done();}
        },
        activated: true
      }
    };

    pluginsManager.run();
    should.not.exist(pluginsManager.controllers['myplugin/dfoo']);
    should(pluginsManager.controllers['myplugin/foo']).be.a.Function();
    pluginsManager.controllers['myplugin/foo']();
  });

  it('should attach controller routes on kuzzle object', function () {
    var
      kuzzle = {},
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = {
      myplugin: {
        object: {
          init: function () {},
          routes: [
            {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'},
            {verb: 'post', url: '/bar', controller: 'foo', action: 'bar'},
          ]
        },
        activated: true
      }
    };

    pluginsManager.run();
    should(pluginsManager.routes).be.an.Array().and.length(2);
    should(pluginsManager.routes[0].verb).be.equal('get');
    should(pluginsManager.routes[0].url).be.equal('/_plugin/myplugin/bar/:name');
    should(pluginsManager.routes[1].verb).be.equal('post');
    should(pluginsManager.routes[1].url).be.equal('/_plugin/myplugin/bar');
    should(pluginsManager.routes[0].controller).be.equal(pluginsManager.routes[0].controller)
                                                    .and.be.equal('myplugin/foo');
    should(pluginsManager.routes[0].action).be.equal(pluginsManager.routes[0].action)
                                                    .and.be.equal('bar');
  });
});