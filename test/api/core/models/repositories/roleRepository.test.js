var
  _ = require('lodash'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  should = require('should'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  User = require.main.require('lib/api/core/models/security/user'),
  kuzzle = {
    repositories: {
      user: {
        anonymous: () => {
          var user = new User();
          user._id = -1;
          user.profile = 'anonymous';
          return user;
        }
      }
    },
    services: {list: {}},
    config: require.main.require('lib/config')(params)
  },
  Role = require.main.require('lib/api/core/models/security/role'),
  RoleRepository = require.main.require('lib/api/core/models/repositories/roleRepository')(kuzzle);


describe('Test: repositories/roleRepository', function () {
  var
    ObjectConstructor,
    forwardedObject,
    persistedObject1,
    persistedObject2,
    mockReadEngine,
    mockWriteEngine,
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
        results = [];

      requestObject.data.body.ids.forEach(function (id) {
        if (id === 'persisted1') {
          results.push({_id:id, found: true, _source: persistedObject1});
        }
        else if (id === 'persisted2') {
          results.push({_id: id, found: true, _source: persistedObject2});
        }
        else {
          results.push({_id: id, found: false});
        }
      });
      return Promise.resolve(new ResponseObject(requestObject, {docs: results}));
    }
  };

  mockWriteEngine = {
    createOrUpdate: function (requestObject) {
      forwardedObject = requestObject;
      return Promise.resolve(new ResponseObject(requestObject, {}));
    }
  };

  before(function () {
    roleRepository = new RoleRepository();
    roleRepository.readEngine = mockReadEngine;
    roleRepository.writeEngine = mockWriteEngine;
  });

  beforeEach(function () {
    roleRepository.roles = {};
  });

  describe('#loadRoles', function () {
    it('should return an empty array when loading some non-existing roles', done => {
      roleRepository.loadRoles(['idontexist'])
        .then(result => {
          should(result).be.an.Array();
          should(result).be.empty();
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should reject the promise if some error occurs fetching data from the DB', () => {
      var result;

      roleRepository.loadMultiFromDatabase = () => {
        return Promise.reject(new InternalError('Error'));
      };
      result = roleRepository.loadRoles([-999, -998])
        .catch(error => {
          delete roleRepository.loadMultiFromDatabase;
          return Promise.reject(error);
        });

      return should(result).be.rejectedWith(InternalError);
    });

    it('should reject the promise if some error occurs during the hydratation', () => {
      var result;

      roleRepository.hydrate = () => {
        return Promise.reject(new InternalError('Error'));
      };

      result = roleRepository.loadRoles(['guest'])
        .catch(error => {
          delete roleRepository.hydrate;
          return Promise.reject(error);
        });

      return should(result).be.rejectedWith(InternalError);
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

    it('should retrieve only the roles that exist', function (done) {
      roleRepository.loadRoles(['guest', 'idontexist'])
        .then(function (results) {
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
          should(results[0]._id).be.exactly('guest');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

  });


  describe('#loadRole', function () {
    it('should return a bad request error when no _id is provided', () => {
      return should(roleRepository.loadRole({})).rejectedWith(BadRequestError);
    });
  });

  describe('#getRoleFromRequestObject', function () {
    it('should build a valid role object', () => {
      var
        indexes = {
          index: {
            collections: {
              collection: {
                controllers: {
                  controller: {
                    actions: {
                      action: true
                    }
                  }
                }
              }
            }
          }
        },
        requestObject = new RequestObject({
          collection: 'collection',
          controller: 'controller',
          action: 'action',
          body: {
            _id: 'roleId',
            indexes: indexes
          }
        }),
        role;

      role = roleRepository.getRoleFromRequestObject(requestObject);

      should(role._id).be.exactly('roleId');
      should(role.indexes).be.eql(indexes);
    });
  });

  describe('#validateAndSaveRole', function () {
    it('should reject the promise if no id is defined', () => {
      var role = new Role();

      return should(roleRepository.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('should reject the promise if an invalid role is given', () => {
      var role = new Role();
      role._id = 'test';

      should(roleRepository.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('persist the role to the database when ok', done => {
      var
        indexes = {
          index: {
            collections: {
              colletion: {
                controllers: {
                  controller: {
                    actions: {
                      action: true
                    }
                  }
                }
              }
            }
          }
        },
        role = new Role();
      role._id = 'test';
      role.indexes = indexes;

      roleRepository.validateAndSaveRole(role)
        .then(() => {
          should(forwardedObject.data._id).be.exactly('test');
          should(forwardedObject.data.body.indexes).be.eql(indexes);

          done();
        });
    });

  });
});
