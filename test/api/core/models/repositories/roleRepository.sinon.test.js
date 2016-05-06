var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire');
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

require('sinon-as-promised')(q.Promise);

describe('Test: repositories/kuzzle.repositories.role', () => {
  var
    kuzzle,
    sandbox,
    ObjectConstructor,
    forwardedObject,
    persistedObject1,
    persistedObject2;

  ObjectConstructor = function () {
    this.type = 'testObject';
  };

  before(() => {
    persistedObject1 = new ObjectConstructor();
    persistedObject1._id = 'persisted1';

    persistedObject2 = new ObjectConstructor();
    persistedObject2._id = 'persisted2';

    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    sandbox.stub(kuzzle.services.list.readEngine, 'get', (requestObject) => {
      var err;

      if (requestObject.data._id === 'persisted1') {
        return q(persistedObject1);
      }
      if (requestObject.data._id === 'persisted2') {
        return q(persistedObject2);
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return q(err);
    });

    sandbox.stub(kuzzle.services.list.readEngine, 'mget', (requestObject) => {
      var
        results = [];

      requestObject.data.body.ids.forEach((id) => {
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
      return q({hits: results});
    });

    sandbox.mock(kuzzle.repositories.role, 'writeLayer', {
      execute: (requestObject) => {
        console.log('************ execute');
        forwardedObject = requestObject;
        return q({});
      }
    });

    sandbox.mock(kuzzle.repositories.role, 'roles', {});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadRoles', () => {
    it('should return an empty array when loading some non-existing roles', () => {
      return kuzzle.repositories.role.loadRoles(['idontexist'])
        .then(result => {
          should(result).be.an.Array();
          should(result).be.empty();
        });
    });

    it('should reject the promise if some error occurs fetching data from the DB', () => {
      var result;

      kuzzle.repositories.role.loadMultiFromDatabase = () => q.reject(new InternalError('Error'));

      result = kuzzle.repositories.role.loadRoles([-999, -998])
        .catch(error => {
          delete kuzzle.repositories.role.loadMultiFromDatabase;
          return q.reject(error);
        });

      return should(result).be.rejectedWith(InternalError);
    });

    it('should reject the promise if some error occurs during the hydratation', () => {
      var result;

      kuzzle.repositories.role.hydrate = () => q.reject(new InternalError('Error'));

      result = kuzzle.repositories.role.loadRoles(['anonymous'])
        .catch(error => {
          delete kuzzle.repositories.role.hydrate;
          return q.reject(error);
        });

      return should(result).be.rejectedWith(InternalError);
    });

    it('should retrieve some persisted roles', () => {
      return kuzzle.repositories.role.loadRoles(['persisted1', 'persisted2'])
        .then(results => {
          should(results).be.an.Array().and.have.length(2);
          results.forEach(result => {
            should(result).be.an.instanceOf(Role);
            should(result._id).be.oneOf(['persisted1', 'persisted2']);
          });
        });
    });

    it('should retrieve the default roles', () => {
      return kuzzle.repositories.role.loadRoles(['anonymous'])
        .then(results =>{
          should(results).be.an.Array().and.have.length(1);
          results.forEach(result => should(result).be.an.instanceOf(Role));
        });
    });

    it('should retrieve only the roles that exist', () => {
      return kuzzle.repositories.role.loadRoles(['anonymous', 'idontexist'])
        .then(results => {
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
        });
    });
  });

  describe('#loadRole', () => {
    it('should return a bad request error when no _id is provided', () => {
      return should(kuzzle.repositories.role.loadRole({})).rejectedWith(BadRequestError);
    });

    it('should load the role directly from memory if it\'s in memory', () => {
      sandbox.stub(kuzzle.repositories.role, 'roles', {roleId : {myRole : {}}});
      sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase').resolves();

      return kuzzle.repositories.role.loadRole('roleId')
        .then((role) => {
          should(kuzzle.repositories.role.loadOneFromDatabase.called).be.false();
          should(role).have.property('myRole');
        });
    });

    it('should load the role directly from DB if it\'s not in memory', () => {

      sandbox.stub(kuzzle.repositories.role, 'roles', {otherRoleId : {myRole : {}}});
      sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase').resolves(kuzzle.repositories.role.roles.otherRoleId);

      return kuzzle.repositories.role.loadRole('roleId')
        .then((role) => {
          should(kuzzle.repositories.role.loadOneFromDatabase.called).be.true();
          should(role).have.property('myRole');
        });
    });
  });

  describe('#searchRole', () => {
    it('should call repository search without filter and with parameters from requestObject', () => {
      var
        savedFilter,
        savedFrom,
        savedSize,
        savedHydrate;

      sandbox.stub(kuzzle.repositories.role, 'search', (filter, from, size, hydrate) => {
        savedFilter = filter;
        savedFrom = from;
        savedSize = size;
        savedHydrate = hydrate;

        return q();
      });

      return kuzzle.repositories.role.searchRole(new RequestObject({body: {from: 1, size: 3, hydrate: false}}))
        .then(() => {
          should(savedFilter).be.eql({});
          should(savedFrom).be.eql(1);
          should(savedSize).be.eql(3);
          should(savedHydrate).be.false();
        });
    });

    it('should construct a correct filter according to indexes', () => {
      var
        savedFilter,
        savedFrom,
        savedSize,
        savedHydrate;

      sandbox.stub(kuzzle.repositories.role, 'search', (filter, from, size, hydrate) => {
        savedFilter = filter;
        savedFrom = from;
        savedSize = size;
        savedHydrate = hydrate;

        return q();
      });

      return kuzzle.repositories.role.searchRole(new RequestObject({body: {indexes: ['test']}}))
        .then(() => {
          should(savedFilter).be.eql({or: [
            // specific index name provided
            {exists: {field: 'indexes.test'}},
            // default filter
            {exists: {field: 'indexes.*'}}
          ]});
        });
    });
  });

  describe('#deleteRole', () => {
    it('should reject if there is no _id', () => {
      return should(kuzzle.repositories.role.deleteRole({})).rejectedWith(BadRequestError);
    });

    it('should call deleteFromDatabase and remove the role from memory', () => {
      var isDeletedFromDB = false;

      sandbox.stub(kuzzle.repositories.role, 'roles', {myRole : {}});

      sandbox.stub(kuzzle.repositories.role, 'deleteFromDatabase').resolves({});

      return kuzzle.repositories.role.deleteRole({_id: 'myRole'})
        .then(() => {
          should(kuzzle.repositories.role.roles).be.eql({});
          should(kuzzle.repositories.role.deleteFromDatabase.called).be.true();
        });
    });
  });

  describe('#getRoleFromRequestObject', () => {
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

      role = kuzzle.repositories.role.getRoleFromRequestObject(requestObject);

      should(role._id).be.exactly('roleId');
      should(role.indexes).be.eql(indexes);
    });
  });

  describe('#validateAndSaveRole', () => {
    it('should reject the promise if no id is defined', () => {
      var role = new Role();

      return should(kuzzle.repositories.role.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('should reject the promise if an invalid role is given', (done) => {
      var role = new Role();
      role._id = 'test';
      kuzzle.repositories.role.validateAndSaveRole(role)
        .then(response => {
          done(response);
        })
        .catch(error => {
          done();
        })
//      return should().be.rejectedWith(BadRequestError);
    });

    it('persist the role to the database when ok', (done) => {
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

      kuzzle.repositories.role.validateAndSaveRole(role)
        .then((response) => {
          console.log(response);
          // should(forwardedObject.data._id).be.exactly('test');
          // should(forwardedObject.data.body.indexes).be.eql(indexes);
          done();
        })
        .catch(err => {
          console.log(err);
          done(err);
        });
    });
  });
});