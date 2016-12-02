var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError;

describe('Test: security controller - users', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        sandbox.stub(kuzzle.services.list.storageEngine, 'search').returns(Promise.resolve({
          hits: [{_id: 'admin', _source: { profileIds: ['admin'] }}],
          total: 1
        }));

        sandbox.stub(kuzzle.repositories.user, 'load', id => {
          if (id === 'anonymous') {
            return kuzzle.repositories.user.anonymous();
          }
          if (id === 'admin') {
            return kuzzle.repositories.user.admin();
          }
          return Promise.resolve(null);
        });

        sandbox.stub(kuzzle.repositories.user, 'deleteFromDatabase').returns(Promise.resolve({_id: 'test'}));
        return null;
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#getUser', () => {
    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.getUser(new Request({}), {})).be.rejected();
    });

    it('should reject with NotFoundError when the user is not found', () => {
      var promise = kuzzle.funnel.controllers.security.getUser(new Request({body: {_id: 'i.dont.exist'}}), {});

      return should(promise).be.rejectedWith(NotFoundError);
    });
  });

  describe('#searchUsers', () => {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'search').returns(Promise.resolve({
        hits: [{_id: 'admin', _source: {profileIds: ['admin']}}],
        total: 2
      }));

      return kuzzle.funnel.controllers.security.searchUsers(new Request({body: {from: 0, size: 200}}), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body).match({hits: [{_id: 'admin'}], total: 2});
        });
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');

      sandbox.stub(kuzzle.repositories.user, 'search').returns(Promise.reject(error));

      return should(kuzzle.funnel.controllers.security.searchUsers(new Request({
        body: {hydrate: false}
      }), {})).be.rejectedWith(error);
    });
  });

  describe('#deleteUser', () => {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'delete').returns(Promise.resolve());

      return kuzzle.funnel.controllers.security.deleteUser(new Request({
        body: { _id: 'test' }
      }), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.status).be.exactly(200);
        });
    });

    it('should not resolve the promise when no id is given', () => {
      return should(kuzzle.funnel.controllers.security.deleteUser(new Request({})), {}).be.rejected();
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');

      sandbox.stub(kuzzle.repositories.user, 'delete').returns(Promise.reject(error));

      return should(kuzzle.funnel.controllers.security.deleteUser(new Request({
        body: {_id: 'test'}
      }), {})).be.rejectedWith(error);
    });
  });

  describe('#createUser', () => {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'}));
      sandbox.stub(kuzzle.repositories.user, 'hydrate').returns(Promise.resolve());

      return kuzzle.funnel.controllers.security.createUser(new Request({
        body: {_id: 'test', name: 'John Doe', profileIds: ['anonymous']}
      }), {})
        .then(response => {
          mock.verify();
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(mock.getCall(0).args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      var
        mockPersist = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'})),
        mockHydrate = sandbox.mock(kuzzle.repositories.user).expects('hydrate').once().returns(Promise.resolve());

      return kuzzle.funnel.controllers.security.createUser(new Request({
        body: {name: 'John Doe', profileIds: ['anonymous']}
      }), {})
        .then(response => {
          mockHydrate.verify();
          mockPersist.verify();
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(mockPersist.getCall(0).args[1]).match({database: {method: 'create'}});
          should(mockHydrate.getCall(0).args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createUser(new Request({body: {}}), {}))
        .be.rejected();
    });
  });

  describe('#createRestrictedUser', () => {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'}));
      sandbox.stub(kuzzle.repositories.user, 'hydrate').returns(Promise.resolve());

      return kuzzle.funnel.controllers.security.createRestrictedUser(new Request({
        body: {_id: 'test', name: 'John Doe'}
      }), {})
        .then(response => {
          mock.verify();
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(mock.getCall(0).args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      var
        mockPersist = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'})),
        mockHydrate = sandbox.mock(kuzzle.repositories.user).expects('hydrate').once().returns(Promise.resolve());

      return kuzzle.funnel.controllers.security.createRestrictedUser(new Request({
        body: {name: 'John Doe'}
      }), {})
        .then(response => {
          mockHydrate.verify();
          mockPersist.verify();
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(mockPersist.getCall(0).args[1]).match({database: {method: 'create'}});
          should(mockHydrate.getCall(0).args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should reject the promise if a profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createRestrictedUser(new Request({
        body: {profileIds: ['foo']}
      }), {}))
        .be.rejected();
    });
  });

  describe('#updateUser', () => {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'}));

      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').returns(Promise.resolve({_id: 'anonymous', _source: {}}));

      return kuzzle.funnel.controllers.security.updateUser(new Request({
        _id: 'test',
        body: {foo: 'bar'}
      }), {})
        .then(response => {
          mock.verify();
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(mock.getCall(0).args[1]).match({database: {method: 'update'}});
          should(response.responseObject.data.body._id).be.exactly('test');
        });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateUser(new Request({body: {}}), {})).be.rejected();
    });

    it('should update the profile correctly', () => {
      sandbox.stub(kuzzle.repositories.user,'persist', user => Promise.resolve(user));
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').returns(Promise.resolve({_id: 'default', _source: {}}));
      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load').returns(Promise.resolve({_id: 'test', profileId: 'default'}));

      return kuzzle.funnel.controllers.security.updateUser(new Request({
        _id: 'test',
        body: {profileIds: ['anonymous'], foo: 'bar'}
      }), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body._id).be.exactly('test');
          should(response.responseObject.data.body._source.profile).be.an.instanceOf(Object);
          should(response.responseObject.data.body._source.foo).be.exactly('bar');
        });
    });
  });

  describe('#createOrReplaceUser', () => {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'hydrate').returns(Promise.resolve());
      sandbox.stub(kuzzle.repositories.user, 'persist').returns(Promise.resolve({_id: 'test'}));

      return kuzzle.funnel.controllers.security.createOrReplaceUser(new Request({
        body: {_id: 'test', profileIds: ['admin']}
      }))
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.status).be.exactly(200);
        });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createOrReplaceUser(new Request({
        _id: 'test'
      }), {})).be.rejected();
    });
  });

  describe('#getUserRights', () => {
    it('should resolve to a responseObject on a getUserRights call', () => {
      var loadUserStub = userId => {
        return {
          _id: userId,
          _source: {},
          getRights: () => {
            return {
              rights1: {
                controller: 'read', action: 'get', index: 'foo', collection: 'bar',
                value: 'allowed'
              },
              rights2: {
                controller: 'write', action: 'delete', index: '*', collection: '*',
                value: 'conditional'
              }
            };
          }
        };
      };

      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load', loadUserStub);
      return kuzzle.funnel.controllers.security.getUserRights(new Request({body: {_id: 'test'}}), {})
        .then(response => {
          var filteredItem;

          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.hits).be.an.Array();
          should(response.responseObject.data.body.hits).length(2);

          filteredItem = response.responseObject.data.body.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = response.responseObject.data.body.hits.filter(item => {
            return item.controller === 'write' &&
                   item.action === 'delete' &&
                   item.index === '*' &&
                   item.collection === '*';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('conditional');
        });
    });

    it('should reject to an error on a getUserRights call without id', () => {
      return should(kuzzle.funnel.controllers.security.getUserRights(new Request({body: {_id: ''}}), {})).be.rejected();
    });

    it('should reject NotFoundError on a getUserRights call with a bad id', () => {
      return should(kuzzle.funnel.controllers.security.getUserRights(new Request({
        body: { _id: 'i.dont.exist' }
      }), {})).be.rejectedWith(NotFoundError);
    });
  });
});
