var
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  Token = require('../../../../lib/api/core/models/security/token'),
  Role = require('../../../../lib/api/core/models/security/role'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError;

describe('Test: routerController', () => {
  var
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.funnel.init();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#newConnection', () => {
    var
      protocol = 'foo',
      userId = 'bar';

    it('should return a promise', () => {
      return should(kuzzle.router.newConnection(protocol, userId)).be.fulfilled();
    });

    it('should have registered the connection', () => {
      var context = kuzzle.router.connections[userId];
      should(context).be.an.Object();
      should(context.connection).be.an.Object();
      should(context.connection.id).be.eql(userId);
      should(context.connection.type).be.eql(protocol);
      should(context.token).be.null();
    });

    it('should declare a new connection to the statistics core component', () => {
      var
        newConnectionDeclared = false;

      kuzzle.statistics.newConnection = context => {
        should(context).be.an.Object();
        should(context.connection).be.an.Object();
        should(context.connection.id).be.eql(userId);
        should(context.connection.type).be.eql(protocol);
        should(context.token).be.null();
        newConnectionDeclared = true;
      };

      kuzzle.router.newConnection(protocol, userId);
      should(newConnectionDeclared).be.true();
    });

    it('should return an error if no user ID is provided', () => {
      return should(kuzzle.router.newConnection(protocol, undefined)).be.rejectedWith(PluginImplementationError);
    });

    it('should return an error if no protocol is provided', () => {
      return should(kuzzle.router.newConnection(undefined, userId)).be.rejectedWith(PluginImplementationError);
    });
  });

  describe('#execute', () => {
    var
      context,
      requestObject = new Request({
        controller: 'read',
        action: 'now'
      });

    before(() => {
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', () => {
        var
          token = new Token(),
          role = new Role(),
          user;

        role.controllers = {
          '*': {
            actions: {
              '*': true
            }
          }
        };

        user = {
          _id: 'user',
          profileIds: ['profile'],
          isActionAllowed: sinon.stub().returns(Promise.resolve(true)),
          getProfile: () => {
            return Promise.resolve({
              _id: 'profile',
              policies: [{roleId: 'role'}],
              getRoles: sinon.stub().returns(Promise.resolve([role])),
              isActionAllowed: sinon.stub().returns(Promise.resolve(true))
            });
          }
        };

        token._id = 'fake-token';
        token.userId = user._id;

        return Promise.resolve(token);
      });

      return kuzzle.router.newConnection('foo', 'bar')
        .then(res => {
          context = res;
        });
    });

    it('should resolve the callback with the right arguments', (done) => {
      sandbox.stub(kuzzle.repositories.user, 'load').returns(Promise.resolve({
        _id: 'user',
        isActionAllowed: sandbox.stub().returns(Promise.resolve(true))
      }));

      kuzzle.repositories.token.verifyToken.restore();
      sandbox.stub(kuzzle.repositories.token, 'verifyToken').returns(Promise.resolve({user: 'user'}));
      sandbox.stub(kuzzle.funnel.controllers.read, 'listIndexes').returns(Promise.resolve());

      kuzzle.router.execute(requestObject, { connection: { type: 'foo', id: 'bar' }, token: {user: 'user'} }, done);
    });

    it('should return an error if no request object is provided', (done) => {
      kuzzle.router.execute(undefined, context, (err) => {
        if (err && err instanceof PluginImplementationError) {
          done();
        }
        else {
          done(new Error('Returned successfully. Expected an error'));
        }
      });
    });

    it('should return an error if an invalid context is provided', (done) => {
      kuzzle.router.execute(requestObject, {}, (err) => {
        if (err && err instanceof PluginImplementationError) {
          done();
        }
        else {
          done(new Error('Returned successfully. Expected an error'));
        }
      });
    });

    it('should return an error if an invalid context ID is provided', (done) => {
      var
        invalidContext = {
          connection: {
            id: 'hey',
            type: 'jude'
          }
        };

      kuzzle.router.execute(requestObject, invalidContext, (err) => {
        if (err && err instanceof PluginImplementationError) {
          done();
        }
        else {
          done(new Error('Returned successfully. Expected an error'));
        }
      });
    });

    it('should forward any error that occured during execution back to the protocol plugin', (done) => {
      kuzzle.funnel.execute = (r, c, cb) => cb(new Error('rejected'));

      kuzzle.router.execute(requestObject, context, (err) => {
        if (err && err instanceof Error) {
          done();
        }
        else {
          done(new Error('Returned successfully. Expected an error'));
        }
      });
    });
  });

  describe('#removeConnection', () => {
    var
      context;

    beforeEach(() => {
      return kuzzle.router.newConnection('foo', 'bar')
        .then(res => {
          context = res;
        });
    });

    it('should remove the context from the context pool', () => {
      var
        unsubscribed = false,
        loggedStats = false;

      kuzzle.hotelClerk.removeCustomerFromAllRooms = connection => {
        should(connection).be.an.Object().and.be.eql(context.connection);
        unsubscribed = true;
      };

      kuzzle.statistics.dropConnection = connection => {
        should(connection).be.an.Object().and.be.eql(context.connection);
        loggedStats = true;
      };

      kuzzle.router.removeConnection(context);
      should(kuzzle.router.connections).be.empty();
      should(unsubscribed).be.true();
      should(loggedStats).be.true();
    });

    it('should trigger a log:error hook if the context is unknown', function (done) {
      var
        fakeContext = {
          connection: { id: 'Madness? No.', type: 'THIS IS SPARTAAAAAAA!'},
          user: null
        };

      this.timeout(50);

      kuzzle.once('log:error', () => done());
      kuzzle.router.removeConnection(fakeContext);
    });
  });
});
