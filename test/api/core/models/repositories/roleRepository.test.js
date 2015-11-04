var
  q = require('q'),
  params = require('rc')('kuzzle'),
  should = require('should'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  kuzzle = {
    repositories: {},
    services: {list: {}},
    config: require.main.require('lib/config')(params)
  },
  Role = require.main.require('lib/api/core/models/security/role'),
  RoleRepository = require.main.require('lib/api/core/models/repositories/roleRepository')(kuzzle);


describe('Test: repositories/roleRepository', function () {
  var
    ObjectConstructor,
    persistedObject1,
    persistedObject2,
    mockReadEngine,
    roleRepository;

  ObjectConstructor = function () {
    this.type = 'testObject';
  };
  persistedObject1 = new ObjectConstructor();
  persistedObject1._id = 'persisted1';

  persistedObject2 = new ObjectConstructor();
  persistedObject2._id = 'persisted2';

  mockReadEngine = {
    get: function (requestObject) {
      var err;

      if (requestObject.data._id === 'persisted1') {
        return Promise.resolve(new ResponseObject(requestObject, persistedObject1));
      }
      if (requestObject.data._id === 'persisted2') {
        return Promise.resolve(new ResponseObject(requestObject, persistedObject2));
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return Promise.resolve(err);
    },
    mget: function (requestObject) {
      var
        promises = [];

      requestObject.data.body.ids.forEach(function (id) {
        var req = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: roleRepository.collection,
          body: {
            _id: id
          }
        });

        promises.push(mockReadEngine.get(req, false));
      });

      return q.all(promises)
        .then(function (results) {
          var result = new ResponseObject(requestObject, {docs: results.map(function (response) {
            if (response instanceof ResponseObject) {
              return response.data;
            }
            return response;
          })});

          return Promise.resolve(result);
        });
    }
  };

  before(function () {
    roleRepository = new RoleRepository();
    roleRepository.readEngine = mockReadEngine;
  });

  beforeEach(function () {
    roleRepository.roles = {};
  });

  describe('#loadRoles', function () {
    it('should reject the promise when loading some non-existing roles', function (done) {
      var foo = roleRepository.loadRoles(['idontexist']);

      should(foo).be.rejectedWith(NotFoundError);
      done();
    });

    it('should retrieve some persisted roles', function (done) {
      roleRepository.loadRoles(['persisted1', 'persisted2'])
        .then(function (results) {
          should(results).be.an.Array().and.have.length(2);
          results.forEach(function (result) {
            should(result).be.an.instanceOf(Role);
            should(result._id).be.oneOf(['persisted1', 'persisted2']);
          });

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should retrieve the default roles', function (done) {
      roleRepository.loadRoles(['guest'])
        .then(function (results) {
          should(results).be.an.Array().and.have.length(1);
          results.forEach(function (result) {
            should(result).be.an.instanceOf(Role);
            should(result._id).be.exactly('guest');
          });
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject the promise in case one of the requested roles does not exist', function (done) {
      var foo = roleRepository.loadRoles(['guest', 'idontexist']);

      should(foo).be.rejectedWith(NotFoundError);
      done();
    });

  });
});
