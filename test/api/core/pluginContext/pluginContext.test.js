'use strict';

const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  Request = require('kuzzle-common-objects').Request,
  _ = require('lodash');

describe('Plugin Context', () => {
  const someCollection = 'someCollection';
  let
    kuzzle,
    context,
    PluginContext;

  beforeEach(() => {
    mockrequire('../../../../lib/services/internalEngine', function () {
      this.init = sinon.spy();
      this.bootstrap = {
        all: sinon.spy(),
        createCollection: sinon.spy()
      };
    });
    PluginContext = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');

    kuzzle = new KuzzleMock();
    context = new PluginContext(kuzzle, 'pluginName');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#constructor', () => {
    it('should be an instance of a PluginContext object', () => {
      should(context).be.an.instanceOf(PluginContext);
    });

    it('should expose the right constructors', () => {
      let repository;
      const Koncorde = require('koncorde');

      should(context.constructors).be.an.Object().and.not.be.empty();
      should(context.constructors.Koncorde).be.a.Function();
      should(context.constructors.Koncorde).be.a.Function();
      should(context.constructors.Request).be.a.Function();
      should(context.constructors.RequestContext).be.a.Function();
      should(context.constructors.RequestInput).be.a.Function();
      should(context.constructors.BaseValidationType).be.a.Function();
      should(context.constructors.Repository).be.a.Function();

      should(new context.constructors.Koncorde).be.instanceOf(Koncorde);
      should(new context.constructors.Koncorde).be.instanceOf(Koncorde);
      should(new context.constructors.Request(new Request({}), {})).be.instanceOf(Request);

      repository = new context.constructors.Repository(someCollection);

      should(repository.search).be.a.Function();
      should(repository.get).be.a.Function();
      should(repository.mGet).be.a.Function();
      should(repository.delete).be.a.Function();
      should(repository.create).be.a.Function();
      should(repository.createOrReplace).be.a.Function();
      should(repository.replace).be.a.Function();
      should(repository.update).be.a.Function();
    });

    describe('#Request', () => {
      it('should throw when trying to instantiate a Request object without providing any data', () => {
        should(function () { new context.constructors.Request(); }).throw(PluginImplementationError);
      });

      it('should replicate the right request information', () => {
        let
          request = new Request({
            action: 'action',
            controller: 'controller',
            foobar: 'foobar',
            _id: '_id',
            index: 'index',
            collection: 'collection',
            result: 'result',
            error: new Error('error'),
            status: 666,
            jwt: 'jwt',
            volatile: {foo: 'bar'}
          }, {
            protocol: 'protocol',
            connectionId: 'connectionId'
          }),
          pluginRequest = new context.constructors.Request(request, {});

        should(pluginRequest.context.protocol).be.eql(request.context.protocol);
        should(pluginRequest.context.connectionId).be.eql(request.context.connectionId);
        should(pluginRequest.result).be.null();
        should(pluginRequest.error).be.null();
        should(pluginRequest.status).be.eql(102);
        should(pluginRequest.input.action).be.null();
        should(pluginRequest.input.controller).be.null();
        should(pluginRequest.input.jwt).be.eql(request.input.jwt);
        should(pluginRequest.input.args.foobar).be.eql(request.input.args.foobar);
        should(pluginRequest.input.resource._id).be.eql(request.input.resource._id);
        should(pluginRequest.input.resource.index).be.eql(request.input.resource.index);
        should(pluginRequest.input.resource.collection).be.eql(request.input.resource.collection);
        should(pluginRequest.input.volatile).match({foo: 'bar'});
      });

      it('should override origin request data with provided ones', () => {
        let
          request = new Request({
            action: 'action',
            controller: 'controller',
            foo: 'foo',
            bar: 'bar',
            _id: '_id',
            index: 'index',
            collection: 'collection',
            result: 'result',
            error: new Error('error'),
            status: 666,
            jwt: 'jwt',
            volatile: {foo: 'bar'}
          }, {
            protocol: 'protocol',
            connectionId: 'connectionId'
          }),
          pluginRequest = new context.constructors.Request(request, {
            action: 'pluginAction',
            controller: 'pluginController',
            foo: false,
            from: 0,
            size: 99,
            collection: 'pluginCollection',
            jwt: null,
            volatile: {foo: 'overridden', bar: 'baz'}
          });

        should(pluginRequest.context.protocol).be.eql('protocol');
        should(pluginRequest.context.connectionId).be.eql('connectionId');
        should(pluginRequest.result).be.null();
        should(pluginRequest.error).be.null();
        should(pluginRequest.status).be.eql(102);
        should(pluginRequest.input.action).be.eql('pluginAction');
        should(pluginRequest.input.controller).be.eql('pluginController');
        should(pluginRequest.input.jwt).be.null();
        should(pluginRequest.input.args.foo).be.eql(false);
        should(pluginRequest.input.args.bar).be.eql('bar');
        should(pluginRequest.input.args.from).be.eql(0);
        should(pluginRequest.input.args.size).be.eql(99);
        should(pluginRequest.input.resource._id).be.eql('_id');
        should(pluginRequest.input.resource.index).be.eql('index');
        should(pluginRequest.input.resource.collection).be.eql('pluginCollection');
        should(pluginRequest.input.volatile).match({foo: 'overridden', bar: 'baz'});
      });

      it('should allow building a request without providing another one', () => {
        const rq = new context.constructors.Request({controller: 'foo', action: 'bar'});

        should(rq).be.instanceOf(Request);
        should(rq.input.action).be.eql('bar');
        should(rq.input.controller).be.eql('foo');
      });
    });

    it('should expose all error objects as capitalized constructors', () => {
      const errors = require('kuzzle-common-objects').errors;

      should(context.errors).be.an.Object().and.not.be.empty();

      _.forOwn(errors, (constructor, name) => {
        should(context.errors[name]).be.a.Function();
        should(new context.errors[name]('foo')).be.instanceOf(constructor);
      });
    });

    it('should expose the right accessors', () => {
      let triggerCalled = 0;

      [
        'silly',
        'verbose',
        'info',
        'debug',
        'warn',
        'error'
      ].forEach(level => {
        should(context.log[level])
          .be.an.instanceOf(Function);

        context.log[level]('test');

        should(kuzzle.pluginsManager.trigger)
          .have.callCount(++triggerCalled);
        should(kuzzle.pluginsManager.trigger.getCall(triggerCalled -1))
          .be.calledWithExactly('log:' + level, 'test');
      });

      should(context.accessors).be.an.Object().and.not.be.empty();
      should(context.accessors).have.properties(['execute', 'validation', 'storage', 'trigger', 'strategies', 'sdk']);
    });

    it('should expose a data validation accessor', () => {
      const validation = context.accessors.validation;

      should(validation.addType).be.eql(kuzzle.validation.addType.bind(kuzzle.validation));
      should(validation.validate).be.eql(kuzzle.validation.validationPromise.bind(kuzzle.validation));
    });

    it('should expose an API execution accessor', () => {
      const execute = context.accessors.execute;

      should(execute).be.a.Function();
    });

    it('should expose an event trigger accessor', () => {
      const trigger = context.accessors.trigger;

      should(trigger).be.a.Function();
    });

    it('should expose a private storage accessor', () => {
      const storage = context.accessors.storage;

      should(storage.bootstrap).be.a.Function();
      should(storage.createCollection).be.a.Function();
    });

    it('should expose an authentication strategies management accessor', () => {
      const strategies = context.accessors.strategies;

      should(strategies.add).be.a.Function();
      should(strategies.remove).be.a.Function();
    });

    it('should expose an SDK client accessor', () => {
      const sdk = context.accessors.sdk;

      should(sdk.query).be.a.Function();
      should(sdk.auth).be.an.Object();
      should(sdk.bulk).be.an.Object();
      should(sdk.collection).be.an.Object();
      should(sdk.document).be.an.Object();
      should(sdk.index).be.an.Object();
      should(sdk.ms).be.an.Object();
      should(sdk.realtime).be.an.Object();
      should(sdk.security).be.an.Object();
      should(sdk.server).be.an.Object();
    });
  });

  describe('#trigger', () => {
    it('should trigger a log:error if eventName contains a colon', () => {
      const trigger = kuzzle.pluginsManager.trigger;
      context.accessors.trigger('event:with:colons');
      should(trigger).be.calledWith('log:error');
    });

    it('should call trigger with the given event name and payload', () => {
      const trigger = kuzzle.pluginsManager.trigger;
      const eventName = 'backHome';
      const payload = {
        question: 'whose motorcycle is this?',
        answer: 'it\'s a chopper, baby.',
        anotherQuestion: 'whose chopper is this, then?',
        anotherAnswer: 'it\'s Zed\'s',
        yetAnotherQuestion: 'who\'s Zed?',
        yetAnotherAnswer: 'Zed\'s dead, baby, Zed\'s dead.'
      };

      context.accessors.trigger(eventName, payload);
      should(trigger).be.calledWithExactly(`plugin-pluginName:${eventName}`, payload);
    });
  });

  describe('#execute', () => {
    it('should call the callback with a result if everything went well', done => {
      const
        request = new Request({requestId: 'request'}, {connectionId: 'connectionid'}),
        result = {foo: 'bar'},
        callback = sinon.spy((err, res) => {
          try {
            should(callback).be.calledOnce();
            should(err).be.null();
            should(res).match(request);
            should(res.result).be.equal(result);
            should(kuzzle.funnel.executePluginRequest).calledWith(request);
            done();
          }
          catch(e) {
            done(e);
          }
        });

      kuzzle.funnel.executePluginRequest.resolves(result);

      should(context.accessors.execute(request, callback)).not.be.a.Promise();
    });

    it('should resolve a Promise with a result if everything went well', () => {
      const
        request = new Request({requestId: 'request'}, {connectionId: 'connectionid'}),
        result = {foo: 'bar'};

      kuzzle.funnel.executePluginRequest.resolves(result);

      const ret = context.accessors.execute(request);

      should(ret).be.a.Promise();

      return ret
        .then(res => {
          should(res).match(request);
          should(res.result).be.equal(result);
          should(kuzzle.funnel.executePluginRequest).calledWith(request);
        });
    });

    it('should call the callback with an error if something went wrong', done => {
      const
        request = new Request({body: {some: 'request'}}, {connectionId: 'connectionid'}),
        error = new Error('error'),
        callback = sinon.spy(
          (err, res) => {
            try {
              should(kuzzle.funnel.executePluginRequest).calledWith(request);
              should(callback).be.calledOnce();
              should(err).match(error);
              should(res).be.undefined();
              done();
            }
            catch(e) {
              done(e);
            }
          });

      kuzzle.funnel.executePluginRequest.rejects(error);

      context.accessors.execute(request, callback);
    });

    it('should reject a Promise with an error if something went wrong', () => {
      const
        request = new Request({body: {some: 'request'}}, {connectionId: 'connectionid'}),
        error = new Error('error');

      kuzzle.funnel.executePluginRequest.rejects(error);

      return context.accessors.execute(request)
        .catch(err => {
          should(kuzzle.funnel.executePluginRequest).calledWith(request);
          should(err).match(error);
        });
    });

    it('should resolve to an error if no Request object is provided', done => {
      const
        callback = sinon.spy(
          (err, res) => {
            try {
              should(kuzzle.funnel.executePluginRequest).not.be.called();
              should(callback).be.calledOnce();
              should(err).be.instanceOf(PluginImplementationError);
              should(err.message).startWith('Invalid argument: a Request object must be supplied');
              should(res).be.undefined();
              done();
            }
            catch(e) {
              done(e);
            }
          });

      context.accessors.execute({}, callback);
    });

    it('should reject if no Request object is provided', () => {
      return should(context.accessors.execute({})).be.rejectedWith(
        /Invalid argument: a Request object must be supplied/
      );
    });

    it('should reject if callback argument is not a function', () => {
      return should(context.accessors.execute({requestId: 'request'}, 'foo'))
        .be.rejectedWith({message: /^Invalid argument: Expected callback to be a function, received "string"/});

    });
  });

  describe('#strategies', () => {
    it('should allow to add a strategy and link it to its owner plugin', () => {
      const
        mockedStrategy = {
          config: {
            authenticator: 'foo'
          }
        },
        result = context.accessors.strategies.add('foo', mockedStrategy);

      should(result).be.a.Promise();

      return result
        .then(() => {
          should(kuzzle.pluginsManager.registerStrategy).calledWith('pluginName', 'foo', mockedStrategy);
          should(kuzzle.pluginsManager.trigger).calledWith('core:auth:strategyAdded', {
            pluginName: 'pluginName',
            name: 'foo',
            strategy: mockedStrategy
          });
        });
    });

    it('should reject the promise if the strategy registration throws', () => {
      const error = new Error('foobar');
      kuzzle.pluginsManager.registerStrategy.throws(error);

      const result = context.accessors.strategies.add('foo', {
        config: {
          authenticator: 'foobar'
        }
      });

      should(result).be.a.Promise();

      return should(result).be.rejectedWith(error);
    });

    it('should throw if no authenticator is provided', () => {

      return should(context.accessors.strategies.add('foo', null))
        .rejectedWith(PluginImplementationError, {message: '[pluginName] Strategy foo: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk).\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.'});
    });

    it('should allow to remove a strategy', () => {
      const result = context.accessors.strategies.remove('foo');

      should(result).be.a.Promise();

      return result
        .then(() => {
          should(kuzzle.pluginsManager.unregisterStrategy).calledWith('pluginName', 'foo');
          should(kuzzle.pluginsManager.trigger).calledWith('core:auth:strategyRemoved', {
            pluginName: 'pluginName',
            name: 'foo'
          });
        });
    });

    it('should reject the promise if the strategy removal throws', () => {
      const error = new Error('foobar');
      kuzzle.pluginsManager.unregisterStrategy.throws(error);

      const result = context.accessors.strategies.remove('foo');

      should(result).be.a.Promise();

      return should(result).be.rejectedWith(error);
    });
  });
});
