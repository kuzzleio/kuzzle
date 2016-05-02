var
  should = require('should'),
  params = require('rc')('kuzzle'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2,
  GatewayTimeoutError = require.main.require('lib/api/core/errors/gatewayTimeoutError'),
  workerPrefix = PluginsManager.__get__('workerPrefix');

describe('Test plugins manager run', function () {
  var
    contextObjects = [
      'ResponseObject',
      'NotificationObject',
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
    pluginsManager,
    pm2Mock;

  pm2Mock = function () {
    /* jshint -W106 */
    var universalProcess = {
      name: workerPrefix + 'foo',
      pm_id: 42
    };
    /* jshint +W106 */
    var busData = {
      'initialized': {
        process: universalProcess,
        data: {
          events: [
            'foo:bar'
          ]
        }
      },
      'process:event': {
        event: 'exit',
        process: universalProcess
      },
      'ready': {
        process: universalProcess
      }
    };
    var
      busListeners,
      processList,
      uniqueness,
      sentMessages;

    return {
      connect: function (callback) {
        callback();
      },
      list: function (callback) {
        callback(null, processList.map(item => item.process));
      },
      delete: function (pmId, callback) {
        processList = processList.filter(item => {
          /* jshint -W106 */
          return item.process.pm_id !== pmId;
          /* jshint +W106 */
        });
        callback(null);
      },
      start: function (processSpec, callback) {
        var i;
        for(i = 0; i < processSpec.instances; i++) {
          /* jshint -W106 */
          processList.push({
            process: {
              name: processSpec.name,
              pm_id: uniqueness++
            }
          });
          /* jshint +W106 */
        }
        callback();
      },
      launchBus: function (callback) {
        callback(null, {
          on: function (event, cb) {
            var wrapper = function (data) {
              cb(data);
            };
            if (!busListeners[event]) {
              busListeners[event] = [];
            }
            busListeners[event].push(wrapper);
          }
        });
      },
      sendDataToProcessId: function (processId, data, callback) {
        sentMessages.push(data);
        callback(null);
      },
      /** Mock only methods */
      resetMock: function () {
        busListeners = {};
        processList = [];
        uniqueness = 0;
        sentMessages = [];
      },
      getProcessList: function () {
        return processList;
      },
      getSentMessages: function() {
        return sentMessages;
      },
      // Should be used to trigger a particular event on the bus
      triggerOnBus: function (event) {
        if (busListeners[event]) {
          busListeners[event].forEach(item => {
            item(busData[event]);
          });
        }
      },
      initializeList: function () {
        processList = [{process: universalProcess}];
      }
      /** END - Mock only methods */
    };
  }();

  before(function () {
    PluginsManager.__set__('console', {
      log: function () {},
      error: function () {}
    });
    PluginsManager.__set__('pm2', pm2Mock);
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
    pm2Mock.resetMock();
  });

  it('should do nothing on run if plugin is not activated', function (done) {
    var isInitialized = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {
          isInitialized = true;
        }
      },
      activated: false
    }];

    pluginsManager.run()
      .then(() => {
        should(isInitialized).be.false();
        done();
      });
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
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        kuzzle.emit('test');
      });
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
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        kuzzle.emit('foo:bar');
      });
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
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo')
          .then(function () {
            should(isCalled).be.true();
            done();
          })
          .catch(error => {
            done(error);
          });
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
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:bar')
          .then(function () {
            should(isCalled).be.true();
            done();
          })
          .catch(error => {
            done(error);
          });
      });
  });

  it('should attach pipes event and reject if an attached function return an error', function (done) {
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
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        should(pluginsManager.trigger('foo:bar')).be.rejected();
        done();
      });
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
      config: {},
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

    pluginsManager.run()
      .then(() => {
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
  });

  it('should timeout the pipe when taking too long to execute', function(done) {
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

    pluginsManager.run()
      .then(() => {
        should(PluginsManager.__get__('triggerPipes').call(pluginsManager, 'foo:bar')).be.rejectedWith(GatewayTimeoutError);
        done();
      });
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
        config: {},
        activated: true
      }
    };

    pluginsManager.run()
      .then(() => {
        should.not.exist(pluginsManager.controllers['myplugin/dfoo']);
        should(pluginsManager.controllers['myplugin/foo']).be.a.Function();
        pluginsManager.controllers['myplugin/foo']();
      });
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
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        kuzzle.emit('test');
      });
  });

  it('should attach controller routes on kuzzle object', function (done) {
    pluginsManager.plugins = {
      myplugin: {
        object: {
          init: function () {},
          config: {},
          controllers: ['foo'],
          routes: [
            {verb: 'get', url: '/bar/:name', controller: 'foo', action: 'bar'},
            {verb: 'post', url: '/bar', controller: 'foo', action: 'bar'}
          ]
        },
        config: {},
        activated: true
      }
    };

    pluginsManager.run()
      .then(() => {
        should(pluginsManager.routes).be.an.Array().and.length(2);
        should(pluginsManager.routes[0].verb).be.equal('get');
        should(pluginsManager.routes[0].url).be.equal('/myplugin/bar/:name');
        should(pluginsManager.routes[1].verb).be.equal('post');
        should(pluginsManager.routes[1].url).be.equal('/myplugin/bar');
        should(pluginsManager.routes[0].controller)
          .be.equal(pluginsManager.routes[0].controller)
          .and.be.equal('myplugin/foo');
        should(pluginsManager.routes[0].action)
          .be.equal(pluginsManager.routes[0].action)
          .and.be.equal('bar');
        done();
      });
  });

  it('should initialize plugin workers if some are defined', function (done) {
    pluginsManager.plugins = {
      foo: {
        config: {
          threads: 2
        },
        activated: true
      }
    };
    pluginsManager.isServer = true;
    pluginsManager.isDummy = false;

    pluginsManager.run()
      .then(() => {
        should(pm2Mock.getProcessList()).be.an.Array().and.length(2);
        done();
      });
  });

  it('should send an initialize message to the process when ready is received', function (done) {
    pluginsManager.plugins = {
      foo: {
        config: {
          threads: 1
        },
        activated: true
      }
    };
    pluginsManager.isServer = true;
    pluginsManager.isDummy = false;

    pluginsManager.run()
      .then(() => {
        var messages;
        pm2Mock.triggerOnBus('ready');
        messages = pm2Mock.getSentMessages();
        should(messages).be.an.Array().and.length(1);
        should(messages[0].topic).be.equal('initialize');
        done();
      });
  });

  it('should add worker to list when initialized is received', function (done) {
    pluginsManager.plugins = {
      foo: {
        config: {
          threads: 1
        },
        activated: true
      }
    };
    pluginsManager.isServer = true;
    pluginsManager.isDummy = false;

    pluginsManager.run()
      .then(() => {
        pm2Mock.triggerOnBus('initialized');
        should(pluginsManager.workers[workerPrefix + 'foo']).be.an.Object();
        should(pluginsManager.workers[workerPrefix + 'foo'].pmIds).be.an.Object();
        should(pluginsManager.workers[workerPrefix + 'foo'].pmIds.getSize()).be.equal(1);
        done();
      });
  });

  it('should remove a worker to list when process:event exit is received', function (done) {
    pluginsManager.plugins = {
      foo: {
        config: {
          threads: 1
        },
        activated: true
      }
    };
    pluginsManager.isServer = true;
    pluginsManager.isDummy = false;

    pluginsManager.run()
      .then(() => {
        pm2Mock.triggerOnBus('initialized');
        should(pluginsManager.workers[workerPrefix + 'foo']).be.an.Object();
        should(pluginsManager.workers[workerPrefix + 'foo'].pmIds).be.an.Object();
        should(pluginsManager.workers[workerPrefix + 'foo'].pmIds.getSize()).be.equal(1);

        pm2Mock.triggerOnBus('process:event');
        should.not.exist(pluginsManager.workers[workerPrefix + 'foo']);
        done();
      });
  });

  it('should receive the triggered message', function (done) {
    var triggerWorkers = PluginsManager.__get__('triggerWorkers');
    pluginsManager.plugins = {
      foo: {
        config: {
          threads: 1,
          hooks: {
            'foo:bar': 'foobar'
          }
        },
        activated: true
      }
    };
    pluginsManager.isServer = true;
    pluginsManager.isDummy = false;


    pluginsManager.run()
      .then(() => {
        pm2Mock.triggerOnBus('initialized');

        should(pluginsManager.workers[workerPrefix + 'foo']).be.an.Object();
        should(pluginsManager.workers[workerPrefix + 'foo'].pmIds).be.an.Object();
        should(pluginsManager.workers[workerPrefix + 'foo'].pmIds.getSize()).be.equal(1);

        triggerWorkers.call(pluginsManager, 'foo:bar', {
          'firstName': 'Ada'
        });

        should(pm2Mock.getSentMessages()).be.an.Array().and.length(1);
        should(pm2Mock.getSentMessages()[0]).be.an.Object();
        should(pm2Mock.getSentMessages()[0].data.message.firstName).be.equal('Ada');
        done();
      });
  });

  it('should delete plugin workers at initialization', function (done) {
    pluginsManager.plugins = {
      foo: {
        config: {
          threads: 1
        },
        activated: true
      }
    };
    pluginsManager.isServer = true;
    pluginsManager.isDummy = false;

    pm2Mock.initializeList();

    pluginsManager.run()
      .then(() => {
        should(pm2Mock.getProcessList()).length(1);
        /* jshint -W106 */
        should(pm2Mock.getProcessList()[0].process.pm_id).not.equal(42);
        /* jshint +W106 */
        done();
      });
  });
});
