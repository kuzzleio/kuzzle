'use strict';

const
  should = require('should'),
  Bluebird = require('bluebird'),
  Kuzzle = require('../../../../mocks/kuzzle.mock'),
  Profile = require('../../../../../lib/api/core/models/security/profile'),
  Role = require('../../../../../lib/api/core/models/security/role'),
  {
    Request,
    errors: { BadRequestError }
  } = require('kuzzle-common-objects');

const
  _kuzzle = Symbol.for('_kuzzle');

describe('Test: security/profileTest', () => {
  const
    context = {connectionId: null, userId: null},
    request = new Request(
      {
        index: 'index',
        collection: 'collection',
        controller: 'controller',
        action: 'action'
      },
      context);
  let
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();

    // Replace the KuzzleMock stub by an empty function,
    // as we need to stub this one in the following tests
    kuzzle.repositories.role.loadRole = () => {};
  });

  it('should disallow any action when no role be found', () => {
    const profile = new Profile();

    return should(profile.isActionAllowed(request)).be.fulfilledWith(false);
  });

  it('should allow the action if one of the roles allows it', () => {
    const
      profile = new Profile(),
      roles = {
        denyRole: new Role(),
        allowRole: new Role()
      };

    roles.denyRole._id = 'denyRole';
    roles.denyRole.controllers = {
      '*': {
        actions: {
          '*': false
        }
      }
    };

    roles.allowRole._id = 'allowRole';
    roles.allowRole.controllers = {
      controller: {
        actions: {
          action: true
        }
      }
    };
    for (const roleId of Object.keys(roles)) {
      roles[roleId][_kuzzle] = kuzzle;
    }

    profile.policies = [{roleId: 'denyRole' }];

    kuzzle.repositories.role.load.callsFake(id => Bluebird.resolve(roles[id]));

    profile[_kuzzle] = kuzzle;
    return profile.isActionAllowed(request)
      .then(isAllowed => {
        should(isAllowed).be.false();

        profile.policies.push({roleId: 'allowRole' });
        return profile.isActionAllowed(request);
      })
      .then(isAllowed => {
        should(isAllowed).be.true();

        profile.policies = [
          {roleId: 'denyRole' },
          {
            roleId: 'allowRole',
            restrictedTo: [
              {index: 'index1' },
              {index: 'index2', collections: ['collection1']},
              {index: 'index3', collections: ['collection1', 'collection2']}
            ]
          }
        ];

        return profile.isActionAllowed(request);
      })
      .then(isAllowed => should(isAllowed).be.false());
  });

  it('should retrieve the correct rights list', () => {
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
      document: {
        actions: { '*': true }
      }
    };

    profile.policies.push({
      roleId: role1._id,
      restrictedTo: [
        { index: 'index1', collections: ['collection1', 'collection2'] }
      ]
    });

    role2._id = 'role2';
    role2.controllers = {
      document: {
        actions: { delete: true, create: true, update: true }
      }
    };

    profile.policies.push({
      roleId: role2._id,
      restrictedTo: [{index: 'index2' }]
    });

    role3._id = 'role3';
    role3.controllers = {
      document: {
        actions: { get: true, count: true, search: true, create: true }
      }
    };

    for (const roleId of Object.keys(roles)) {
      roles[roleId][_kuzzle] = kuzzle;
    }

    profile.constructor._hash = kuzzle.constructor.hash;

    profile.policies.push({roleId: role3._id});

    kuzzle.repositories.role.load.callsFake(id => Bluebird.resolve(roles[id]));

    profile[_kuzzle] = kuzzle;
    return profile.getRights()
      .then(rights => {
        let filteredItem;

        should(rights).be.an.Object();
        rights = Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []);
        should(rights).be.an.Array();

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === 'get');

        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('*');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === '*');

        should(filteredItem).length(2);
        should(filteredItem.every(item => item.index === 'index1')).be.equal(true);
        should(filteredItem.some(item => item.collection === 'collection1')).be.equal(true);
        should(filteredItem.some(item => item.collection === 'collection2')).be.equal(true);
        should(filteredItem.every(item => item.value === 'allowed')).be.equal(true);

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === 'delete');

        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('index2');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === 'update');

        should(
          filteredItem
            .every(item => item.index === 'index2'
              && item.collection === '*'
              && item.value === 'allowed'))
          .be.equal(true);
      });
  });

  describe('#validateDefinition', () => {
    it('should reject if no policies are provided', () => {
      const profile = new Profile();
      profile.policies = null;
      profile._id = 'test';

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.missing_mandatory_policies_attribute' });
    });

    it('should reject if an empty policies array is provided', () => {
      const profile = new Profile();
      profile._id = 'test';

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.empty_policies_attribute' });
    });

    it('should reject if no roleId is given', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{}];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.missing_mandatory_roleId_attribute' });
    });

    it('should reject if an invalid attribute is given', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{ roleId: 'admin', foo: 'bar' }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.unexpected_attribute_in_policies' });
    });

    it('should reject if restrictedTo is not an array', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{ roleId: 'admin', restrictedTo: 'bar' }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.attribute_restrictedTo_not_an_array_of_objects' });
    });

    it('should reject if restrictedTo contains a non-object value', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{ roleId: 'admin', restrictedTo: [null] }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.restrictedTo_field_must_be_an_object' });
    });

    it('should reject if restrictedTo does not contain an index', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{ roleId: 'admin', restrictedTo: [{ foo: 'bar' }] }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.missing_mandatory_index_attribute_in_restrictedTo_array' });
    });

    it('should reject if restrictedTo is given an invalid attribute', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', foo: 'bar' }]
      }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.unexptected_attribute_in_restrictedTo_array' });
    });

    it('should reject if restrictedTo.collections is not an array', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', collections: 'bar' }]
      }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.attribute_collections_not_an_array_in_retrictedTo' });
    });

    it('should reject if restrictedTo.collections is not an array of strings', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', collections: ['bar', 123] }]
      }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.attribute_collections_not_contains_not_only_non_empty_strings' });
    });

    it('should reject if restrictedTo.collections contains an empty string', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', collections: ['bar', ''] }]
      }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.attribute_collections_not_contains_not_only_non_empty_strings' });
    });

    it('should reject if restrictedTo.index is not a string', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: false, collections: ['bar', 'baz'] }]
      }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.index_attribute_is_empty_string' });
    });

    it('should reject if restrictedTo.index is an empty string', () => {
      const profile = new Profile();
      profile._id = 'test';
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: '', collections: ['bar', 'baz'] }]
      }];

      return should(profile.validateDefinition()).be.rejectedWith(
        BadRequestError,
        { errorName: 'api.security.index_attribute_is_empty_string' });
    });
  });
});
