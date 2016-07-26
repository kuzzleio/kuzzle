var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

require('sinon-as-promised')(Promise);

describe('Test: security controller - users', function () {
  var
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(function () {
        // Mock
        kuzzle.services.list.readEngine.search = () => {
          return Promise.resolve({
            hits: [{_id: 'admin', _source: { profilesIds: ['admin'] }}],
            total: 1
          });
        };

        kuzzle.repositories.user.load = id => {
          if (id === 'anonymous') {
            return kuzzle.repositories.user.anonymous();
          }
          if (id === 'admin') {
            return kuzzle.repositories.user.admin();
          }

          return Promise.resolve(null);
        };

        kuzzle.repositories.user.persist = (user) => {
          return Promise.resolve(user);
        };

        kuzzle.repositories.user.deleteFromDatabase = () => {
          return Promise.resolve({_id: 'test'});
        };
      });
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#getUser', function () {
    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.getUser(new RequestObject({})))
        .be.rejected();
    });

    it('should reject with NotFoundError when the user is not found', () => {
      var promise;

      sandbox.stub(kuzzle.repositories.user, 'load').resolves(null);
      promise = kuzzle.funnel.controllers.security.getUser(new RequestObject({
        body: { _id: 'i.dont.exist' }
      }));

      return should(promise).be.rejectedWith(NotFoundError);
    });
  });

  describe('#searchUsers', function () {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'search').resolves({
        hits: [{_id: 'admin', _source: {profilesIds: ['admin']}}],
        total: 2
      });

      return kuzzle.funnel.controllers.security.searchUsers(new RequestObject({
        body: {
          filter: {},
          from: 0,
          size: 200
        }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body).match({hits: [{_id: 'admin'}], total: 2});
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.user, 'search').rejects();
      return should(kuzzle.funnel.controllers.security.searchUsers(new RequestObject({
        body: {}
      }))).be.rejected();
    });
  });

  describe('#deleteUser', function () {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'delete').resolves();
      return kuzzle.funnel.controllers.security.deleteUser(new RequestObject({
        body: { _id: 'test' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.status).be.exactly(200);
        });
    });

    it('should not resolve the promise when no id is given', () => {
      return should(kuzzle.funnel.controllers.security.deleteUser(new RequestObject({})))
        .be.rejected();
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.user, 'delete').rejects();
      return should(kuzzle.funnel.controllers.security.deleteUser(new RequestObject({
        body: {_id: 'test'}
      }))).be.rejected();
    });
  });

  describe('#createUser', function () {
    it('should return a valid response', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().resolves({_id: 'test'});
      sandbox.stub(kuzzle.repositories.user, 'hydrate').resolves();

      return kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: { _id: 'test', name: 'John Doe', profilesIds: ['anonymous'] }
      }))
        .then(response => {
          mock.verify();
          should(response).be.an.instanceOf(ResponseObject);
          should(mock.getCall(0).args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      var
        mockPersist = sandbox.mock(kuzzle.repositories.user).expects('persist').once().resolves({_id: 'test'}),
        mockHydrate = sandbox.mock(kuzzle.repositories.user).expects('hydrate').once().resolves();

      return kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: { name: 'John Doe', profilesIds: ['anonymous'] }
      }))
        .then(response => {
          mockHydrate.verify();
          mockPersist.verify();
          should(response).be.an.instanceOf(ResponseObject);
          should(mockPersist.getCall(0).args[1]).match({database: {method: 'create'}});
          should(mockHydrate.getCall(0).args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: {}
      })))
        .be.rejected();
    });
  });

  describe('#updateUser', function () {
    it('should return a valid ResponseObject', () => {
      var mock = sandbox.mock(kuzzle.repositories.user).expects('persist').once().resolves({_id: 'test'});

      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves({_id: 'anonymous', _source: {}});
      sandbox.stub(kuzzle.repositories.user, 'load').resolves({});

      return kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        _id: 'test',
        body: { foo: 'bar' }
      }))
        .then(response => {
          mock.verify();
          should(response).be.an.instanceOf(ResponseObject);
          should(mock.getCall(0).args[1]).match({database: {method: 'update'}});
          should(response.data.body._id).be.exactly('test');
        });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        body: {}
      })))
        .be.rejected();
    });

    it('should update the profile correctly', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves({_id: 'default', _source: {}});
      sandbox.stub(kuzzle.repositories.user, 'load').resolves({_id: 'test', profileId: 'default'});

      return kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        _id: 'test',
        body: {profilesIds: ['anonymous'], foo: 'bar'}
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._id).be.exactly('test');
          should(response.data.body._source.profile).be.an.instanceOf(Object);
          should(response.data.body._source.foo).be.exactly('bar');
        });
    });
  });

  describe('#createOrReplaceUser', function () {
    it('should return a valid responseObject', () => {
      sandbox.stub(kuzzle.repositories.user, 'hydrate').resolves();
      sandbox.stub(kuzzle.repositories.user, 'persist').resolves({_id: 'test'});

      return kuzzle.funnel.controllers.security.createOrReplaceUser(new RequestObject({
        body: {
          _id: 'test',
          profilesIds: ['admin']
        }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.status).be.exactly(200);
        });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createOrReplaceUser(new RequestObject({
        _id: 'test'
      })))
        .be.rejected();
    });
  });

  describe('#getUserRights', function () {
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

      sandbox.stub(kuzzle.repositories.user, 'load', loadUserStub);
      return kuzzle.funnel.controllers.security.getUserRights(new RequestObject({
        body: {_id: 'test'}
      }))
        .then(result => {
          var filteredItem;

          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).length(2);

          filteredItem = result.data.body.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = result.data.body.hits.filter(item => {
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
      return should(kuzzle.funnel.controllers.security.getUserRights(new RequestObject({body: {_id: ''}}))).be.rejected();
    });

    it('should reject NotFoundError on a getUserRights call with a bad id', () => {
      sandbox.stub(kuzzle.repositories.user, 'load').resolves(null);
      return should(kuzzle.funnel.controllers.security.getUserRights(new RequestObject({
        body: { _id: 'i.dont.exist' }
      }))).be.rejectedWith(NotFoundError);
    });
  });
});
