var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  q = require('q'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Token = require.main.require('lib/api/core/models/security/token'),
  User = require.main.require('lib/api/core/models/security/user'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  PluginImplementationError = require.main.require('lib/api/core/errors/pluginImplementationError');

describe('Test: routerController', () => {
  describe('#newConnection', () => {
    var
      kuzzle,
      protocol = 'foo',
      userId = 'bar';

    before(() => {
      kuzzle = new Kuzzle();
      return kuzzle.start(params, {dummy: true});
    });

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
      kuzzle,
      context,
      requestObject = new RequestObject({
        controller: 'read',
        action: 'now'
      });

    before((done) => {
      kuzzle = new Kuzzle();
      kuzzle.start(params, {dummy: true})
        .then(() => {

          kuzzle.repositories.token.verifyToken = function() {
            var
              token = new Token(),
              role = new Role(),
              user = new User();

            role.controllers = {
                '*': {
                  actions: {
                    '*': true
                  }
                }
            };

            user._id = 'testUser';
            user.profile = new Profile();
            user.profile.roles = [role];

            token._id = 'fake-token';
            token.user = user;

            return q(token);
          };

          return kuzzle.router.newConnection('foo', 'bar');
        })
        .then(res => {
          context = res;
          done();
        })
        .catch(error => done(error));
    });

    it('should return a fulfilled promise with the right arguments', (done) => {
      kuzzle.router.execute(requestObject, context, done);
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
      kuzzle,
      context;

    beforeEach((done) => {
      kuzzle = new Kuzzle();
      kuzzle.start(params, {dummy: true})
        .then(() => {
          return kuzzle.router.newConnection('foo', 'bar');
        })
        .then(res => {
          context = res;
          done();
        })
        .catch(error => done(error));
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
