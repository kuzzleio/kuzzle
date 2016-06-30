var
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Role = require.main.require('lib/api/core/models/security/role'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('sinon-as-promised')(q.Promise);

describe('Test: repositories/roleRepository', function () {
  var
    kuzzle,
    ObjectConstructor,
    forwardedObject,
    persistedObject1,
    persistedObject2,
    sandbox;

  /**
   * @constructor
   */
  ObjectConstructor = function () {
    this.type = 'testObject';
  };

  persistedObject1 = new ObjectConstructor();
  persistedObject1._id = 'persisted1';

  persistedObject2 = new ObjectConstructor();
  persistedObject2._id = 'persisted2';

  before(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadRoles', function () {
    it('should return an empty array when loading some non-existing roles', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'mget').resolves({hits: [{_id: 'idontexist', found: false}]});
      return kuzzle.repositories.role.loadRoles(['idontexist'])
        .then(result => {
          should(result).be.an.Array();
          should(result).be.empty();
        });
    });

    it('should reject the promise if some error occurs fetching data from the DB', () => {
      sandbox.stub(kuzzle.repositories.role, 'loadMultiFromDatabase').rejects(new InternalError('Error'));
      return should(kuzzle.repositories.role.loadRoles([-999, -998])).be.rejectedWith(InternalError);
    });

    it('should retrieve some persisted roles', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'mget').resolves({
        hits: [{_id: 'persisted1', found: true, _source: persistedObject1},
              {_id: 'persisted2', found: true, _source: persistedObject2}]
      });
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
      sandbox.stub(kuzzle.services.list.readEngine, 'mget').resolves({
        hits: [{_id: 'anonymous', found: true, _source: {}}]
      });
      return kuzzle.repositories.role.loadRoles(['anonymous'])
        .then(results =>{
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
          should(results[0]._id).be.exactly('anonymous');
        });
    });

    it('should retrieve only the roles that exist', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'mget').resolves({
        hits: [{_id: 'anonymous', found: true, _source: {}}]
      });
      return kuzzle.repositories.role.loadRoles(['anonymous', 'idontexist'])
        .then(results => {
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
          should(results[0]._id).be.exactly('anonymous');
        });
    });

    it('should retrieve only the roles that exist', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'mget').resolves({
        hits: [{_id: 'anonymous', found: true, _source: {}}]
      });
      return kuzzle.repositories.role.loadRoles([{_id: 'anonymous', restrictedTo: 'restrictedToValue'}, 'idontexist'])
        .then(results => {
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
          should(results[0]._id).be.exactly('anonymous');
          should(results[0].restrictedTo).be.exactly('restrictedToValue');
        });
    });
  });

  describe('#loadRole', function () {
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
      sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase').resolves({myRole : {}});

      return kuzzle.repositories.role.loadRole('roleId')
        .then((role) => {
          should(kuzzle.repositories.role.loadOneFromDatabase.calledOnce).be.true();
          should(role).have.property('myRole');
        });
    });
  });

  describe('#searchRole', function () {
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

    it('should construct a correct filter according to controllers', () => {
      var
        savedFilter;

      sandbox.stub(kuzzle.repositories.role, 'search', (filter) => {
        savedFilter = filter;

        return q();
      });

      return kuzzle.repositories.role.searchRole(new RequestObject({body: {controllers: ['test']}}))
        .then(() => {
          should(savedFilter).be.eql({or: [
            // specific controller name provided
            {exists: {field: 'controllers.test'}},
            // default filter
            {exists: {field: 'controllers.*'}}
          ]});
        });
    });
  });

  describe('#deleteRole', function () {
    it('should reject if there is no _id', () => {
      return should(kuzzle.repositories.role.deleteRole({})).rejectedWith(BadRequestError);
    });

    it('should reject if a profile uses the role about to be deleted', () => {
      sandbox.stub(kuzzle.repositories.profile, 'profiles', {
        'test': {
          _id: 'test',
          policies: ['test']
        }
      });
      sandbox.stub(kuzzle.repositories.role, 'roles', {
        'test': {}
      });
      sandbox.stub(kuzzle.repositories.profile.readEngine, 'search').resolves({total: 1, hits: ['test']});

      return should(kuzzle.repositories.role.deleteRole({_id: 'test'})).rejectedWith(BadRequestError);
    });

    it('should call deleteFromDatabase and remove the role from memory', () => {
      sandbox.stub(kuzzle.repositories.role, 'roles', {myRole : {}});

      sandbox.stub(kuzzle.repositories.role, 'deleteFromDatabase').resolves();
      sandbox.stub(kuzzle.repositories.profile, 'search').resolves({total: 0});

      return kuzzle.repositories.role.deleteRole({_id: 'myRole'})
        .then(() => {
          should(kuzzle.repositories.role.roles).be.eql({});
          should(kuzzle.repositories.role.deleteFromDatabase.calledOnce).be.true();
        });
    });
  });

  describe('#getRoleFromRequestObject', function () {
    it('should build a valid role object', () => {
      var
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        requestObject = new RequestObject({
          collection: 'collection',
          controller: 'controller',
          action: 'action',
          body: {
            _id: 'roleId',
            controllers: controllers
          }
        }),
        role;

      role = kuzzle.repositories.role.getRoleFromRequestObject(requestObject);

      should(role._id).be.exactly('roleId');
      should(role.controllers).be.eql(controllers);
    });
  });

  describe('#validateAndSaveRole', function () {
    it('should reject the promise if no id is defined', () => {
      var role = new Role();

      return should(kuzzle.repositories.role.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('should reject the promise if an invalid role is given', () => {
      var role = new Role();
      role._id = 'test';

      return should(kuzzle.repositories.role.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('persist the role to the database when ok', () => {
      var
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        role = new Role();
      role._id = 'test';
      role.controllers = controllers;

      sandbox.stub(kuzzle.repositories.role.writeLayer, 'execute', requestObject => {
        forwardedObject = requestObject;
        return q({});
      });

      return kuzzle.repositories.role.validateAndSaveRole(role)
        .then(() => {
          should(forwardedObject.data._id).be.exactly('test');
          should(forwardedObject.data.body.controllers).be.eql(controllers);
        });
    });
  });
});
