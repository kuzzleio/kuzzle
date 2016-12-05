var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  SecurityController = require('../../../../lib/api/controllers/securityController');

describe('Test: security controller - users', () => {
  var
    kuzzle,
    securityController;

  before(() => {
    kuzzle = new Kuzzle();
    securityController = new SecurityController(kuzzle);
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
    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.getUser(new Request({}));
      }).throw(BadRequestError);
    });

    it('should reject with NotFoundError when the user is not found', () => {
      var promise = securityController.getUser(new Request({_id: 'i.dont.exist'}));

      return should(promise).be.rejectedWith(NotFoundError);
    });
  });

  describe('#searchUsers', () => {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'search').returns(Promise.resolve({
        hits: [{_id: 'admin', _source: {profileIds: ['admin']}}],
        total: 2
      }));

      return securityController.searchUsers(new Request({body: {from: 0, size: 200}}), {})
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).match({hits: [{_id: 'admin'}], total: 2});
        });
    });

    it('should reject an error in case of error', () => {
      var error = new Error('Mocked error');

      sandbox.stub(kuzzle.repositories.user, 'search').returns(Promise.reject(error));

      return should(securityController.searchUsers(new Request({body: {hydrate: false}})))
        .be.rejectedWith(error);
    });
  });

  describe('#deleteUser', () => {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'delete').returns(Promise.resolve());

      return securityController.deleteUser(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error when no id is given', () => {
      return should(() => {
        securityController.deleteUser(new Request({}));
      }).throw(BadRequestError);
    });

    it('should reject an error in case of error', () => {
      var error = new Error('Mocked error');

      sandbox.stub(kuzzle.repositories.user, 'delete').returns(Promise.reject(error));

      return should(securityController.deleteUser(new Request({_id: 'test'}))).be.rejectedWith(error);
    });
  });

  describe('#createUser', () => {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'}));

      sandbox.stub(kuzzle.repositories.user, 'hydrate').returns(Promise.resolve());

      return securityController.createUser(new Request({
        _id: 'test', body: {name: 'John Doe', profileIds: ['anonymous']}
      }))
        .then(response => {
          mock.verify();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(mock.getCall(0).args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      var
        mockPersist = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'})),
        mockHydrate = sandbox.mock(kuzzle.repositories.user).expects('hydrate').once().returns(Promise.resolve());

      return securityController.createUser(new Request({body: {name: 'John Doe', profileIds: ['anonymous']}}))
        .then(response => {
          mockHydrate.verify();
          mockPersist.verify();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(mockPersist.getCall(0).args[1]).match({database: {method: 'create'}});
          should(mockHydrate.getCall(0).args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should throw an error if no profile is given', () => {
      return should(() => {
        securityController.createUser(new Request({body: {}}));
      }).throw(BadRequestError);
    });
  });

  describe('#createRestrictedUser', () => {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'}));
      sandbox.stub(kuzzle.repositories.user, 'hydrate').returns(Promise.resolve());

      return securityController.createRestrictedUser(new Request({
        body: {_id: 'test', name: 'John Doe'}
      }), {})
        .then(response => {
          mock.verify();
          should(response.userContext).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(mock.getCall(0).args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      var
        mockPersist = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'})),
        mockHydrate = sandbox.mock(kuzzle.repositories.user).expects('hydrate').once().returns(Promise.resolve());

      return securityController.createRestrictedUser(new Request({body: {name: 'John Doe'}}))
        .then(response => {
          mockHydrate.verify();
          mockPersist.verify();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(mockPersist.getCall(0).args[1]).match({database: {method: 'create'}});
          should(mockHydrate.getCall(0).args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should throw an error if a profile is given', () => {
      return should(() => {
        securityController.createRestrictedUser(new Request({body: {profileIds: ['foo']}}));
      }).throw(BadRequestError);
    });
  });

  describe('#updateUser', () => {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().returns(Promise.resolve({_id: 'test'}));

      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').returns(Promise.resolve({_id: 'anonymous', _source: {}}));

      return securityController.updateUser(new Request({_id: 'test', body: {foo: 'bar'}}))
        .then(response => {
          mock.verify();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(mock.getCall(0).args[1]).match({database: {method: 'update'}});
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateUser(new Request({body: {}}));
      }).throw(BadRequestError);
    });

    it('should update the profile correctly', () => {
      sandbox.stub(kuzzle.repositories.user,'persist', user => Promise.resolve(user));
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').returns(Promise.resolve({_id: 'default', _source: {}}));
      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load').returns(Promise.resolve({_id: 'test', profileId: 'default'}));

      return securityController.updateUser(new Request({
        _id: 'test',
        body: {profileIds: ['anonymous'], foo: 'bar'}
      }), {})
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
          should(response._source.profile).be.an.instanceOf(Object);
          should(response._source.foo).be.exactly('bar');
        });
    });
  });

  describe('#createOrReplaceUser', () => {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'hydrate').returns(Promise.resolve());
      sandbox.stub(kuzzle.repositories.user, 'persist').returns(Promise.resolve({_id: 'test'}));

      return securityController.createOrReplaceUser(new Request({_id: 'test', body: {profileIds: ['admin']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
        });
    });

    it('should reject the promise if no profile is given', () => {
      return should(() => {
        securityController.createOrReplaceUser(new Request({_id: 'test'}));
      }).throw();
    });
  });

  describe('#getUserRights', () => {
    it('should resolve to an object on a getUserRights call', () => {
      var loadUserStub = userId => {
        return Promise.resolve({
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
        });
      };

      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load', loadUserStub);
      return securityController.getUserRights(new Request({_id: 'test'}))
        .then(response => {
          var filteredItem;

          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).length(2);

          filteredItem = response.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = response.hits.filter(item => {
            return item.controller === 'write' &&
                   item.action === 'delete' &&
                   item.index === '*' &&
                   item.collection === '*';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('conditional');
        });
    });

    it('should throw an error on a getUserRights call without id', () => {
      return should(() => {
        securityController.getUserRights(new Request({_id: ''}));
      }).throw();
    });

    it('should reject NotFoundError on a getUserRights call with a bad id', () => {
      return should(securityController.getUserRights(new Request({_id: 'i.dont.exist'}))).be.rejectedWith(NotFoundError);
    });
  });
});
