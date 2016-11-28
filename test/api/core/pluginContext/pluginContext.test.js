var
  rewire = require('rewire'),
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginContext = rewire('../../../../lib/api/core/plugins/pluginContext'),
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  _ = require('lodash');

describe('Plugin Context', () => {
  var
    kuzzle,
    context;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    context = new PluginContext(kuzzle);
  });

  describe('#constructor', () => {
    it('should be an instance of a PluginContext object', () => {
      should(context).be.an.instanceOf(PluginContext);
    });

    it('should expose the right constructors', () => {
      var
        Dsl = require.main.require('lib/api/dsl'),
        ResponseObject = require('kuzzle-common-objects').Models.responseObject;

      should(context.constructors).be.an.Object().and.not.be.empty();
      should(context.constructors.Dsl).be.a.Function();
      should(context.constructors.RequestObject).be.a.Function();
      should(context.constructors.ResponseObject).be.a.Function();
      should(context.constructors.BaseValidationType).be.a.Function();

      should(new context.constructors.Dsl).be.instanceOf(Dsl);
      should(new context.constructors.RequestObject({})).be.instanceOf(RequestObject);
      should(new context.constructors.ResponseObject).be.instanceOf(ResponseObject);
    });

    it('should expose all error objects as capitalized constructors', () => {
      var
        errors = require('kuzzle-common-objects').Errors;

      should(context.errors).be.an.Object().and.not.be.empty();

      _.forOwn(errors, (constructor, name) => {
        var capitalized = _.upperFirst(name);

        should(context.errors[capitalized]).be.a.Function();
        should(new context.errors[capitalized]('foo')).be.instanceOf(constructor);
      });
    });

    it('should expose the right accessors', () => {
      should(context.accessors).be.an.Object().and.not.be.empty();
      should(context.accessors).have.properties(['passport', 'execute', 'users', 'validation']);
    });

    it('should expose a correctly constructed validation accessor', () => {
      var validation = context.accessors.validation;

      should(validation.addType).be.eql(kuzzle.validation.addType.bind(kuzzle.validation));
      should(validation.validate).be.eql(kuzzle.validation.validationPromise.bind(kuzzle.validation));
    });

    it('should expose a correctly execute accessor', () => {
      var execute = context.accessors.execute;

      should(execute).be.a.Function();
    });

    it('should expose a users.load accessor', () => {
      should(context.accessors.users).be.an.Object();
      should(context.accessors.users.load).be.a.Function();

      context.accessors.users.load();
      should(kuzzle.repositories.user.load).be.calledOnce();
    });

    it('should allow creating users', () => {
      PluginContext.__with__({
        createUser: sinon.spy()
      })(() => {
        should(context.accessors.users.create).be.a.Function();

        context.accessors.users.create();
        should(PluginContext.__get__('createUser')).be.calledOnce();
        should(PluginContext.__get__('createUser')).be.calledWith(kuzzle.repositories.user);
      });
    });

  });

  describe('#createUser', () => {
    var
      repository,
      createUser = PluginContext.__get__('createUser');

    beforeEach(() => {
      repository = {
        ObjectConstructor: sinon.stub().returns({}),
        hydrate: sinon.stub().returns(Promise.resolve()),
        persist: sinon.stub().returns(Promise.resolve())
      };
    });

    it('should reject user creation with incorrect name argument', () => {
      return should(createUser(repository, ['incorrect']))
        .be.rejectedWith(PluginImplementationError);
    });

    it('should reject user creation with incorrect userInfo argument', () => {
      return should(createUser(repository, 'foo', ['incorrect']))
        .be.rejectedWith(PluginImplementationError);
    });

    it('should allow to create a user', () => {
      return createUser(repository, 'foo', 'profile', {foo: 'bar'})
        .then(response => {
          try {
            should(repository.ObjectConstructor).be.calledOnce();

            should(repository.hydrate).be.calledOnce();
            should(repository.hydrate).be.calledWith({}, {
              _id: 'foo',
              foo: 'bar',
              profileIds: ['profile']
            });

            should(repository.persist).be.calledOnce();
            should(repository.persist.firstCall.args[1]).be.eql({
              database: {
                method: 'create'
              }
            });

            sinon.assert.callOrder(
              repository.ObjectConstructor,
              repository.hydrate,
              repository.persist
            );

            should(response).be.eql({
              _id: 'foo',
              foo: 'bar',
              profileIds: ['profile']
            });

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    describe('#execute', () => {
      var
        execute = PluginContext.__get__('execute'),
        processRequest,
        processRequestStub;

      beforeEach(() => {
        processRequestStub = sinon.stub();
        processRequest = PluginContext.__get__('processRequest');
        PluginContext.__set__('processRequest', processRequestStub);
      });

      afterEach(() => {
        PluginContext.__set__('processRequest', processRequest);
      });

      it('should call the callback with a result if everything went well', () => {
        var
          request = {some: 'request'},
          response = {responseObject: {some: 'response'}},
          userContext = {some: 'context'},
          callback = sinon.spy((err, res) => {
            should(callback).be.calledOnce();
            should(err).be.null();
            should(res).match(response.responseObject);

            should(processRequestStub.firstCall.args[0]).be.eql(kuzzle);
            should(processRequestStub.firstCall.args[1]).be.eql(request);
            should(processRequestStub.firstCall.args[2]).be.eql(userContext);

            return Promise.resolve();
          });

        processRequestStub.returns(Promise.resolve(response));

        return execute.bind(kuzzle)(request, userContext, callback);
      });

      it('should call the callback with an error if something went wrong', () => {
        var
          request = new RequestObject({
            body: {some: 'request'}
          }),
          userContext = {some: 'context'},
          error = new Error('error'),
          callback = sinon.spy(
            (err, res) => {
              should(processRequestStub.firstCall.args[0]).be.eql(kuzzle);
              should(processRequestStub.firstCall.args[1]).be.eql(request);
              should(processRequestStub.firstCall.args[2]).be.eql(userContext);

              should(callback).be.calledOnce();
              should(err).match(error);
              should(res).match({});

              return Promise.resolve().then(() => {
                // allows handleErrorDump to be called
                should(kuzzle.funnel.handleErrorDump).be.calledOnce();
                should(kuzzle.funnel.handleErrorDump.firstCall.args[0]).match(error);

                return Promise.resolve();
              });
            });

        processRequestStub.returns(Promise.reject(error));

        return execute.bind(kuzzle)(request, userContext, callback);
      });
    });

    describe('#processRequest', () => {
      var
        processRequest;

      beforeEach(() => {
        processRequest = PluginContext.__get__('processRequest');
        kuzzle.funnel.controllers.customController = {
          customAction: sinon.stub().returns(Promise.resolve())
        };
      });

      it('should call a controller properly', () => {
        var
          requestObject = {
            controller: 'customController',
            action: 'customAction'
          },
          userContext = {
            some: 'context'
          };

        return processRequest(kuzzle, requestObject, userContext)
          .then(() => {
            should(kuzzle.funnel.controllers.customController.customAction).be.calledOnce();
            should(kuzzle.funnel.controllers.customController.customAction.firstCall.args[0]).match(requestObject);
            should(kuzzle.funnel.controllers.customController.customAction.firstCall.args[1]).match(userContext);
          });
      });

      it('should reject a promise if the requestObject has invalid information', () => {
        var
          requestObject = {
            controller: 'customController',
            action: 'nonExistingAction'
          },
          userContext = {
            some: 'context'
          };

        should(
          processRequest(kuzzle, requestObject, userContext)
        ).be.rejectedWith(BadRequestError);
      });
    });
  });

});
