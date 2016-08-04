var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginContext = rewire('../../../../lib/api/core/plugins/pluginContext'),
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
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
        RequestObject = require('kuzzle-common-objects').Models.requestObject,
        ResponseObject = require('kuzzle-common-objects').Models.responseObject;

      should(context.constructors).be.an.Object().and.not.be.empty();
      should(context.constructors.Dsl).be.a.Function();
      should(context.constructors.RequestObject).be.a.Function();
      should(context.constructors.ResponseObject).be.a.Function();

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
      should(context.accessors).have.properties(['router', 'users']);
    });

    it('should expose a correctly constructed router accessor', () => {
      var router = context.accessors.router;

      should(router.newConnection).be.eql(kuzzle.router.newConnection.bind(kuzzle.router));
      should(router.execute).be.eql(kuzzle.router.execute.bind(kuzzle.router));
      should(router.removeConnection).be.eql(kuzzle.router.execute.bind(kuzzle.router));
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
        hydrate: sinon.stub().resolves(),
        persist: sinon.stub().resolves()
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
        });
    });


  });

});
