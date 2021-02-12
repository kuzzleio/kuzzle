'use strict';

const root = '../../../..';

const mockrequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const _ = require('lodash');
const { Client: ESClient } = require('@elastic/elasticsearch');

const {
  Request,
  KuzzleRequest,
  KuzzleError,
  UnauthorizedError,
  TooManyRequestsError,
  SizeLimitError,
  ServiceUnavailableError,
  PreconditionError,
  PluginImplementationError,
  PartialError,
  NotFoundError,
  InternalError,
  GatewayTimeoutError,
  ForbiddenError,
  ExternalServiceError,
  BadRequestError,
} = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const MutexMock = require('../../../mocks/mutex.mock');
const { EmbeddedSDK } = require('../../../../lib/core/shared/sdk/embeddedSdk');

describe('Plugin Context', () => {
  const someCollection = 'someCollection';
  let kuzzle;
  let context;
  let PluginContext;

  beforeEach(() => {
    mockrequire('../../../../lib/util/mutex', { Mutex: MutexMock });
    ({ PluginContext } = mockrequire.reRequire(`${root}/lib/core/plugin/pluginContext`));
    kuzzle = new KuzzleMock();
    context = new PluginContext('pluginName');
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
      should(context.constructors.Request).be.a.Function();
      should(context.constructors.RequestContext).be.a.Function();
      should(context.constructors.RequestInput).be.a.Function();
      should(context.constructors.BaseValidationType).be.a.Function();
      should(context.constructors.Repository).be.a.Function();

      should(new context.constructors.Koncorde).be.instanceOf(Koncorde);
      should(new context.constructors.Request(new Request({}), {})).be.instanceOf(KuzzleRequest);

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

    it('should exposes secrets from vault', () => {
      should(context.secrets)
        .not.be.undefined()
        .match({
          aws: {
            secretKeyId: 'the cake is a lie'
          },
          kuzzleApi: 'the spoon does not exist'
        });
    });

    describe('#ESClient', () => {
      it('should expose the ESClient constructor', () => {
        const storageClient = new context.constructors.ESClient();

        should(storageClient).be.instanceOf(ESClient);
      });

      it('should allow to instantiate an ESClient connected to the ES cluster', () => {
        const storageClient = new context.constructors.ESClient();

        should(storageClient.connectionPool.connections[0].url.origin)
          .be.eql(kuzzle.config.services.storageEngine.client.node);
      });
    });

    describe('#Request', () => {
      it('should throw when trying to instantiate a Request object without providing any data', () => {
        should(function () { new context.constructors.Request(); })
          .throw(PluginImplementationError, { id: 'plugin.context.missing_request_data' });
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

        should(rq).be.instanceOf(KuzzleRequest);
        should(rq.input.action).be.eql('bar');
        should(rq.input.controller).be.eql('foo');
      });
    });

    it('should expose all error objects as capitalized constructors', () => {
      const errors = {
        KuzzleError,
        UnauthorizedError,
        TooManyRequestsError,
        SizeLimitError,
        ServiceUnavailableError,
        PreconditionError,
        PluginImplementationError,
        PartialError,
        NotFoundError,
        InternalError,
        GatewayTimeoutError,
        ForbiddenError,
        ExternalServiceError,
        BadRequestError,
      };

      should(context.errors).be.an.Object().and.not.be.empty();

      _.forOwn(errors, (constructor, name) => {
        should(context.errors[name]).be.a.Function();
        should(new context.errors[name]('foo')).be.instanceOf(constructor);
      });
    });

    it('should expose the right accessors', () => {
      [
        'verbose',
        'info',
        'debug',
        'warn',
        'error'
      ].forEach(level => {
        should(context.log[level]).be.an.instanceOf(Function);

        context.log[level]('test');

        should(kuzzle.log[level])
          .calledOnce()
          .calledWithExactly('[pluginName] test');
      });

      should(context.accessors).be.an.Object().and.not.be.empty();
      should(context.accessors).have.properties(
        ['execute', 'validation', 'storage', 'trigger', 'subscription', 'strategies', 'sdk']);
    });

    it('should add the plugin name in logs', done => {
      context.log.info('foobar');

      process.nextTick(() => {
        try {
          should(kuzzle.log.info)
            .be.calledOnce()
            .be.calledWith('[pluginName] foobar');

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should expose a data validation accessor', () => {
      const validation = context.accessors.validation;

      should(validation.addType)
        .be.eql(kuzzle.validation.addType.bind(kuzzle.validation));
      should(validation.validate)
        .be.eql(kuzzle.validation.validate.bind(kuzzle.validation));
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

    it('should expose a EmbeddedSDK in accessors', () => {
      const sdk = context.accessors.sdk;

      should(sdk).be.instanceOf(EmbeddedSDK);
    });

    it('should expose a realtime accessor', () => {
      const subscription = context.accessors.subscription;

      should(subscription.register).be.a.Function();
      should(subscription.unregister).be.a.Function();
    });

    describe('#accessors.subscription functions', () => {
      it('should call register with the right ask and argument', async () => {
        const customRequest = new Request(
          {
            action: 'subscribe',
            body: {
              equals: {
                name: 'Luca'
              }
            },
            collection: 'yellow-taxi',
            controller: 'realtime',
            index: 'nyc-open-data',
          },
          {
            connectionId: 'superid',
          });

        await context.accessors.subscription.register(
          customRequest.context.connection.id,
          customRequest.input.index,
          customRequest.input.collection,
          customRequest.input.body
        );

        should(kuzzle.ask).be.calledWith('core:realtime:subscribe', sinon.match(
          {
            context: {
              connection: {
                id: customRequest.context.connection.id
              }
            },
            input: {
              body: customRequest.input.body,
              collection: customRequest.input.collection,
              index: customRequest.input.index
            }
          }
        ));
      });

      it('should call unregister with the right ask and argument', async () => {
        await context.accessors.subscription.unregister('connectionId', 'roomId', false);
        should(kuzzle.ask).be.calledWithExactly('core:realtime:unsubscribe', 'connectionId', 'roomId', false);
      });
    });

    describe('#trigger', () => {
      it('should call trigger with the given event name and payload and return pipe chain result', async () => {
        kuzzle.pipe.resolves('pipe chain result');
        const eventName = 'backHome';
        const payload = {
          question: 'whose motorcycle is this?',
          answer: 'it\'s a chopper, baby.',
          anotherQuestion: 'whose chopper is this, then?',
          anotherAnswer: 'it\'s Zed\'s',
          yetAnotherQuestion: 'who\'s Zed?',
          yetAnotherAnswer: 'Zed\'s dead, baby, Zed\'s dead.'
        };

        const result = await context.accessors.trigger(eventName, payload);

        should(result).be.eql('pipe chain result');
        should(kuzzle.pipe)
          .be.calledWithExactly(`plugin-pluginName:${eventName}`, payload);
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

      it('should reject if trying to call forbidden methods from realtime controller', () => {
        return Promise.resolve()
          .then(() => {
            return should(context.accessors.execute(new Request({
              controller: 'realtime',
              action: 'subscribe'
            })))
              .be.rejectedWith(PluginImplementationError, {
                id: 'plugin.context.unavailable_realtime'
              });
          })
          .then(() => {
            return should(context.accessors.execute(new Request({
              controller: 'realtime',
              action: 'unsubscribe'
            })))
              .be.rejectedWith(PluginImplementationError, {
                id: 'plugin.context.unavailable_realtime'
              });
          });
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
            should(kuzzle.pipe).calledWith('core:auth:strategyAdded', {
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
            should(kuzzle.pipe).calledWith('core:auth:strategyRemoved', {
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
});
