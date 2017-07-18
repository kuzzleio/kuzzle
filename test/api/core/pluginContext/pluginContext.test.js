'use strict';

const
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  should = require('should'),
  Promise = require('bluebird'),
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
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');
    PluginContext = rewire('../../../../lib/api/core/plugins/pluginContext');

    kuzzle = new KuzzleMock();
    context = new PluginContext(kuzzle, 'pluginName');
  });

  describe('#constructor', () => {
    it('should be an instance of a PluginContext object', () => {
      should(context).be.an.instanceOf(PluginContext);
    });

    it('should expose the right constructors', () => {
      let repository;
      const Dsl = require('../../../../lib/api/dsl');

      should(context.constructors).be.an.Object().and.not.be.empty();
      should(context.constructors.Dsl).be.a.Function();
      should(context.constructors.Request).be.a.Function();
      should(context.constructors.RequestContext).be.a.Function();
      should(context.constructors.RequestInput).be.a.Function();
      should(context.constructors.BaseValidationType).be.a.Function();
      should(context.constructors.Repository).be.a.Function();

      should(new context.constructors.Dsl).be.instanceOf(Dsl);
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

    it('should throw when trying to instante a Request object without providing a request object', () => {
      should(function () { new context.constructors.Request({}); }).throw(PluginImplementationError);
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
          jwt: 'jwt'
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
      should(context.accessors).have.properties(['execute', 'validation', 'storage', 'trigger']);
    });

    it('should expose a correctly constructed validation accessor', () => {
      const validation = context.accessors.validation;

      should(validation.addType).be.eql(kuzzle.validation.addType.bind(kuzzle.validation));
      should(validation.validate).be.eql(kuzzle.validation.validationPromise.bind(kuzzle.validation));
    });

    it('should expose a correctly execute accessor', () => {
      const execute = context.accessors.execute;

      should(execute).be.a.Function();
    });

    it('should expose correctly a trigger accessor', () => {
      const trigger = context.accessors.trigger;

      should(trigger).be.a.Function();
    });

    it('should expose a correctly constructed storage accessor', () => {
      const storage = context.accessors.storage;

      should(storage.bootstrap).be.a.Function();
      should(storage.createCollection).be.a.Function();
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
        question: 'who\'s is this motorcycle?',
        answer: 'it\'s a chopper, baby.',
        anotherQuestion: 'who\'s is this chopper, then?',
        anotherAnswer: 'it\'s Zed\'s',
        yetAnotherQuestion: 'who\'s Zed?',
        yetAnotherAnswer: 'Zed\'s dead, baby, Zed\'s dead.'
      };

      context.accessors.trigger(eventName, payload);
      should(trigger).be.calledWithExactly(`plugin-pluginName:${eventName}`, payload);
    });
  });

  describe('#execute', () => {
    let execute;

    beforeEach(() => {
      execute = PluginContext.__get__('execute');
    });

    it('should call the callback with a result if everything went well', done => {
      const
        request = new Request({requestId: 'request'}, {connectionId: 'connectionid'}),
        callback = sinon.spy((err, res) => {
          should(callback).be.calledOnce();
          should(err).be.null();
          should(res).match(request);

          should(kuzzle.funnel.processRequest.firstCall.args[0]).be.eql(request);

          done();
        });

      kuzzle.funnel.processRequest.returns(Promise.resolve(request));

      execute.bind(kuzzle)(request, callback);
    });

    it('should resolve a Promise with a result if everything went well', () => {
      const request = new Request({requestId: 'request'}, {connectionId: 'connectionid'});

      kuzzle.funnel.processRequest.returns(Promise.resolve(request));

      return execute.bind(kuzzle)(request)
        .then(res => {
          should(res).match(request);

          should(kuzzle.funnel.processRequest.firstCall.args[0]).be.eql(request);
        });
    });

    it('should call the callback with an error if something went wrong', done => {
      const
        request = new Request({body: {some: 'request'}}, {connectionId: 'connectionid'}),
        error = new Error('error'),
        callback = sinon.spy(
          (err, res) => {
            should(kuzzle.funnel.processRequest.firstCall.args[0]).be.eql(request);

            should(callback).be.calledOnce();
            should(err).match(error);
            should(res).match({});

            return Promise.resolve().then(() => {
              // allows handleErrorDump to be called
              should(kuzzle.funnel.handleErrorDump).be.calledOnce();
              should(kuzzle.funnel.handleErrorDump.firstCall.args[0]).match(error);

              done();
            });
          });

      kuzzle.funnel.processRequest.returns(Promise.reject(error));

      execute.bind(kuzzle)(request, callback);
    });

    it('should reject a Promise with an error if something went wrong', () => {
      const
        request = new Request({body: {some: 'request'}}, {connectionId: 'connectionid'}),
        error = new Error('error');

      kuzzle.funnel.processRequest.returns(Promise.reject(error));

      return execute.bind(kuzzle)(request)
        .catch((err) => {
          should(kuzzle.funnel.processRequest.firstCall.args[0]).be.eql(request);

          should(err).match(error);

          return Promise.resolve().then(() => {
            // allows handleErrorDump to be called
            should(kuzzle.funnel.handleErrorDump).be.calledOnce();
            should(kuzzle.funnel.handleErrorDump.firstCall.args[0]).match(error);
          });
        });
    });
  });
});
