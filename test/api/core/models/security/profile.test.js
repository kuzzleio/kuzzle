'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  Kuzzle = require('../../../../mocks/kuzzle.mock'),
  Profile = require('../../../../../lib/api/core/models/security/profile'),
  Role = require('../../../../../lib/api/core/models/security/role'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: security/profileTest', () => {
  const
    context = {connectionId: null, userId: null},
    request = new Request({
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    }, context);
  let
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();

    // Replace the KuzzleMock stub by an empty function,
    // as we need to stub this one in the following tests
    kuzzle.repositories.role.loadRole = () => {};
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should disallow any action when no role be found', () => {
    const profile = new Profile();

    return should(profile.isActionAllowed(request)).be.fulfilledWith(false);
  });

  it('should allow the action if one of the roles allows it', () => {
    const
      profile = new Profile(),
      roles = {
        disallowAllRole: new Role(),
        allowActionRole: new Role()
      };

    roles.disallowAllRole._id = 'disallowAllRole';
    roles.disallowAllRole.controllers = {
      '*': {
        actions: {
          '*': false
        }
      }
    };

    roles.allowActionRole._id = 'allowActionRole';
    roles.allowActionRole.controllers = {
      controller: {
        actions: {
          action: true
        }
      }
    };

    profile.policies = [{roleId: 'disallowAllRole'}];

    sandbox.stub(kuzzle.repositories.role, 'loadRole').callsFake(roleId => Promise.resolve(roles[roleId]));

    return profile.isActionAllowed(request, kuzzle)
      .then(isAllowed => {
        should(isAllowed).be.false();

        profile.policies.push({roleId: 'allowActionRole'});
        return profile.isActionAllowed(request, kuzzle);
      })
      .then(isAllowed => {
        should(isAllowed).be.true();

        profile.policies = [
          {_id: 'disallowAllRole'},
          {
            _id: 'allowActionRole',
            restrictedTo: [
              {index: 'index1'},
              {index: 'index2', collections: ['collection1']},
              {index: 'index3', collections: ['collection1', 'collection2']}
            ]
          }
        ];

        return profile.isActionAllowed(request, kuzzle);
      })
      .then(isAllowed => should(isAllowed).be.false());
  });

  it('should retrieve the good rights list', () => {
    const
      profile = new Profile(),
      role1 = new Role(),
      role2 = new Role(),
      role3 = new Role(),
      roles = {
        role1: role1,
        role2: role2,
        role3: role3
      };

    role1._id = 'role1';
    role1.controllers = {
      read: {
        actions: { '*': true }
      }
    };

    profile.policies.push({roleId: role1._id, restrictedTo: [{ index: 'index1', collections: ['collection1', 'collection2'] }]});

    role2._id = 'role2';
    role2.controllers = {
      write: {
        actions: { publish: true, create: true, update: true }
      }
    };

    profile.policies.push({roleId: role2._id, restrictedTo: [{index: 'index2'}]});

    role3._id = 'role3';
    role3.controllers = {
      read: {
        actions: { get: true, count: true, search: true }
      },
      write: {
        actions: { update: {test: 'return true;'}, create: true, delete: {test: 'return true;'} }
      }
    };
    profile.policies.push({roleId: role3._id});

    sandbox.stub(kuzzle.repositories.role, 'loadRole').callsFake(roleId => Promise.resolve(roles[roleId]));

    return profile.getRights(kuzzle)
      .then(rights => {
        let filteredItem;

        should(rights).be.an.Object();
        rights = Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []);
        should(rights).be.an.Array();

        filteredItem = rights.filter(item => {
          return item.controller === 'read' &&
                  item.action === 'get';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('*');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'read' &&
                  item.action === '*';
        });
        should(filteredItem).length(2);
        should(filteredItem.every(item => item.index === 'index1')).be.equal(true);
        should(filteredItem.some(item => item.collection === 'collection1')).be.equal(true);
        should(filteredItem.some(item => item.collection === 'collection2')).be.equal(true);
        should(filteredItem.every(item => item.value === 'allowed')).be.equal(true);

        filteredItem = rights.filter(item => {
          return item.controller === 'write' && item.action === 'publish';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('index2');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'write' && item.action === 'update';
        });
        should(filteredItem.every(item => {
          return (item.index === '*' && item.collection === '*' && item.value === 'conditional') ||
            (item.index === 'index2' && item.collection === '*' && item.value === 'allowed');
        })).be.equal(true);

        filteredItem = rights.filter(item => {
          return item.controller === 'write' && item.action === 'delete';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('*');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('conditional');

        filteredItem = rights.filter(item => {
          return item.controller === 'read' && item.action === 'listIndexes';
        });
        should(filteredItem).length(0);
      });
  });

  describe('#validateDefinition', () => {
    it('should reject if no policies are given', () => {
      const profile = new Profile();
      profile._id = 'test';

      return should(profile.validateDefinition())
        .be.rejectedWith('The "policies" attribute array cannot be empty');
    });

    it('should reject if no roleId is given', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{}];

      return should(profile.validateDefinition())
        .be.rejectedWith('policies[0] Missing mandatory attribute "roleId"');
    });

    it('should reject if an invalid attribute is given', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        foo: 'bar'
      }];

      return should(profile.validateDefinition())
        .be.rejectedWith('policies[0] Unexpected attribute "foo". Valid attributes are "roleId" and "restrictedTo"');
    });

    it('should reject if restrictedTo is not an array', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: 'bar'
      }];

      return should(profile.validateDefinition())
        .be.rejectedWith('policies[0] Expected "restrictedTo" to be an array of objects');
    });

    it('should reject if restrictedTo is not given an index', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{
          foo: 'bar'
        }]
      }];

      return should(profile.validateDefinition())
        .be.rejectedWith('policies[0].restrictedTo[0] Missing mandatory attribute "index"');
    });

    it('should reject if restrictedTo is given an invalid attribute', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{
          index: 'index',
          foo: 'bar'
        }]
      }];

      return should(profile.validateDefinition())
        .be.rejectedWith('policies[0].restrictedTo[0] Unexpected attribute "foo". Valid attributes are "index" and "collections"');
    });
  });

});
