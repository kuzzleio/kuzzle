var
  PluginContext = require.main.require('lib/api/core/plugins/pluginContext'),
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  sinon = require('sinon'),
  should = require('should'),
  _ = require('lodash');

require('sinon-as-promised');

describe('Plugin Context', () => {
  var
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    kuzzle.isServer = true;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should be an instance of a PluginContext object', () => {
    should(new PluginContext(kuzzle)).be.instanceOf(PluginContext);
  });

  it('should expose the right constructors', () => {
    var
      context = new PluginContext(kuzzle),
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
      context = new PluginContext(kuzzle),
      errors = require('kuzzle-common-objects').Errors;

    should(context.errors).be.an.Object().and.not.be.empty();

    _.forOwn(errors, (constructor, name) => {
      var capitalized = _.upperFirst(name);

      should(context.errors[capitalized]).be.a.Function();
      should(new context.errors[capitalized]('foo')).be.instanceOf(constructor);
    });
  });

  it('should not expose accessors if not in a kuzzle server instance', () => {
    var
      context;

    kuzzle.isServer = false;
    context = new PluginContext(kuzzle);

    should(context.accessors).be.an.Object().and.be.empty();
  });

  it('should expose the right accessors', () => {
    var context = new PluginContext(kuzzle);

    should(context.accessors).be.an.Object().and.not.be.empty();
    should(context.accessors).have.properties(['router', 'users']);
  });

  it('should expose a correctly constructed router accessor', () => {
    var
      context = new PluginContext(kuzzle),
      nCnxStub = sandbox.stub(kuzzle.router, 'newConnection'),
      execStub = sandbox.stub(kuzzle.router, 'execute'),
      rCnxStub = sandbox.stub(kuzzle.router, 'removeConnection');

    should(context.accessors.router).be.an.Object();
    should(context.accessors.router.newConnection).be.a.Function();
    should(context.accessors.router.execute).be.a.Function();
    should(context.accessors.router.removeConnection).be.a.Function();

    context.accessors.router.newConnection();
    should(nCnxStub.calledOnce).be.true();
    should(nCnxStub.calledOn(kuzzle.router)).be.true();

    context.accessors.router.execute();
    should(execStub.calledOnce).be.true();
    should(execStub.calledOn(kuzzle.router)).be.true();

    context.accessors.router.removeConnection();
    should(rCnxStub.calledOnce).be.true();
    should(rCnxStub.calledOn(kuzzle.router)).be.true();
  });

  it('should expose a users.load accessor', () => {
    var
      context = new PluginContext(kuzzle),
      loadStub = sandbox.stub(kuzzle.repositories.user, 'load');

    should(context.accessors.users).be.an.Object();
    should(context.accessors.users.load).be.a.Function();

    context.accessors.users.load();
    should(loadStub.calledOnce).be.true();
  });

  it('should allow creating users', () => {
    var
      context = new PluginContext(kuzzle),
      hydrStub = sandbox.stub(kuzzle.repositories.user, 'hydrate').resolves({}),
      persStub = sandbox.stub(kuzzle.repositories.user, 'persist').resolves({});

    should(context.accessors.users.create).be.a.Function();

    return context.accessors.users.create('foobar', {foo: 'bar'})
      .then(userInfo => {
        should(userInfo).match({_id: 'foobar', foo: 'bar', profile: 'default'});
        should(hydrStub.calledOnce).be.true();
        should(persStub.calledOnce).be.true();
      });
  });

  it('should reject user creation with incorrect name argument', () => {
    var
      context = new PluginContext(kuzzle);

    return should(context.accessors.users.create(['incorrect'])).be.rejectedWith(PluginImplementationError);
  });

  it('should reject user creation with incorrect userInfo argument', () => {
    var
      context = new PluginContext(kuzzle);
    return should(context.accessors.users.create('foo', ['incorrect'])).be.rejectedWith(PluginImplementationError);
  });

});
