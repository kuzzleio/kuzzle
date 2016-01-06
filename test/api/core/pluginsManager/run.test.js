var
  should = require('should'),
  params = require('rc')('kuzzle'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2,
  GatewayTimeoutError = require.main.require('lib/api/core/errors/gatewayTimeoutError');

require('should-promised');

describe('Test plugins manager run', function () {
  var
    contextObjects = [
      'ResponseObject',
      'RealTimeResponseObject',
      'BadRequestError',
      'ForbiddenError',
      'GatewayTimeoutError',
      'InternalError',
      'KuzzleError',
      'NotFoundError',
      'PartialError',
      'ServiceUnavailableError',
      'UnauthorizedError',
      'repositories'
    ],
    kuzzle,
    pluginsManager;

  before(function () {
    PluginsManager.__set__('console', {log: function () {}, error: function () {}});
  });

  beforeEach(() => {
    kuzzle = new EventEmitter({
      wildcard: true,
      maxListeners: 30,
      delimiter: ':'
    });
    kuzzle.config = { pluginsManager: params.pluginsManager };
    kuzzle.repositories = {
      repository: 'repository',
      userRepository: 'userRepository',
      roleRepository: 'roleRepository',
      profileRepository: 'profileRepository'
    };

    pluginsManager = new PluginsManager(kuzzle);
  });

  it('should do nothing on run if plugin is not activated', function () {
    var isInitialized = false;

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
    var isCalled = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo': 'myFunc'
        },
        myFunc: function (object, callback) {
          isCalled = true;
          callback(null, object);
        }
      },
      activated: true
    }];

    pluginsManager.run();
    pluginsManager.trigger('foo')
      .then(function () {
        should(isCalled).be.true();
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should attach pipes event with wildcard', function (done) {
    var isCalled = false;

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
      })
      .catch(error => {
        done(error);
      });
  });

  it('should attach pipes event and reject if an attached function return an error', function () {
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
    return should(pluginsManager.trigger('foo:bar')).be.rejected();
  });

  it('should log a warning in case a pipe plugin exceeds the warning delay', done => {
    var
      warnings = [];

    pluginsManager.plugins = [];


    pluginsManager.plugins.push({
      object: {
        init: () => {},
        hooks: {'log:warn': 'warn'},
        warn: (msg) => { warnings.push(msg); }
      },
      activated: true
    });

    pluginsManager.plugins.push({
      name: 'pipeTest',
      object: {
        init: () => {},
        pipes: {
          'foo:bar': 'myFunc'
        },
        myFunc: (object, callback) => {
          setTimeout(() => {
            callback(null, object);
          }, 50);
        }
      },
      config: {
        pipeWarnTime: 20
      },
      activated: true
    });

    pluginsManager.run();
    PluginsManager.__get__('triggerPipes').call(pluginsManager, 'foo:bar')
      .then(result => {
        should(warnings).have.length(1);
        should(warnings[0]).be.exactly('Pipe plugin pipeTest exceeded 20ms to execute.');
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should timeout the pipe when taking too long to execute', function() {
    pluginsManager.plugins = [{
      name: 'pipeTest',
      object: {
        init: () => {},
        pipes: {
          'foo:bar': 'myFunc'
        },
        myFunc: (object, callback) => {
          setTimeout(() => {
            callback(null, object);
          }, 50);
        }
      },
      config: {
        pipeTimeout: 30
      },
      activated: true
    }];

    pluginsManager.run();

    return should(PluginsManager.__get__('triggerPipes').call(pluginsManager, 'foo:bar')).be.rejectedWith(GatewayTimeoutError);
  });

  it('should attach controller actions on kuzzle object', function (done) {
    pluginsManager.plugins = {
      myplugin: {
        object: {
          init: function (config, context) {},
          controllers: {
            'foo': 'FooController'
          },
          FooController: function(){done();}
        },
        activated: true
      }
    };

    pluginsManager.run();
    should.not.exist(pluginsManager.controllers['myplugin/dfoo']);
    should(pluginsManager.controllers['myplugin/foo']).be.a.Function();
    pluginsManager.controllers['myplugin/foo']();
  });

  it('should see the context object within the plugin', function (done) {
    pluginsManager.plugins = [{
      object: {
        context: null,
        init: function (config, context) {
            this.context = context;
        },
        hooks: {
          'test': 'myFunc'
        },
        myFunc: function () {
          var
            context = this.context,
            repositories = context.repositories();
          contextObjects.forEach(function (item) {
            should(context[item]).be.a.Function();
          });
          should(repositories.repository).be.equal('repository');
          should(repositories.userRepository).be.equal('userRepository');
          should(repositories.roleRepository).be.equal('roleRepository');
          should(repositories.profileRepository).be.equal('profileRepository');
          done();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    kuzzle.emit('test');
  });

  it('should attach controller routes on kuzzle object', function () {
    pluginsManager.plugins = {
      myplugin: {
        object: {
          init: function () {},
          routes: [
            {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'},
            {verb: 'post', url: '/bar', controller: 'foo', action: 'bar'}
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
    should(pluginsManager.routes[0].controller)
      .be.equal(pluginsManager.routes[0].controller)
      .and.be.equal('myplugin/foo');
    should(pluginsManager.routes[0].action)
      .be.equal(pluginsManager.routes[0].action)
      .and.be.equal('bar');
  });

  it('should run server plugins only on server instances', function () {
    var
      loadedByServer = false,
      loadedByWorker = false;

    pluginsManager.plugins = {
      serverPlugin: {
        object: {
          init: function () { loadedByServer = true; }
        },
        activated: true,
        config: {
          loadedBy: 'server'
        }
      },
      workerPlugin: {
        object: {
          init: function () { loadedByWorker = true; }
        },
        activated: true,
        config: {
          loadedBy: 'worker'
        }
      }
    };

    pluginsManager.isServer = true;
    pluginsManager.run();

    should(loadedByServer).be.true();
    should(loadedByWorker).be.false();
  });

  it('should run worker plugins only on worker instances', function () {
    var
      loadedByServer = false,
      loadedByWorker = false;

    pluginsManager.plugins = {
      serverPlugin: {
        object: {
          init: function () { loadedByServer = true; }
        },
        activated: true,
        config: {
          loadedBy: 'server'
        }
      },
      workerPlugin: {
        object: {
          init: function () { loadedByWorker = true; }
        },
        activated: true,
        config: {
          loadedBy: 'worker'
        }
      }
    };

    pluginsManager.isServer = false;
    pluginsManager.run();

    should(loadedByServer).be.false();
    should(loadedByWorker).be.true();
  });

  it('should always start plugins with loadedBy="all"', function () {
    var
      loadedByServer = false,
      loadedByWorker = false;

    pluginsManager.plugins = {
      serverPlugin: {
        object: {
          init: function () { loadedByServer = true; }
        },
        activated: true,
        config: {
          loadedBy: 'all'
        }
      },
      workerPlugin: {
        object: {
          init: function () { loadedByWorker = true; }
        },
        activated: true,
        config: {
          loadedBy: 'all'
        }
      }
    };

    pluginsManager.isServer = false;
    pluginsManager.run();

    should(loadedByServer).be.true();
    should(loadedByWorker).be.true();
  });
});
