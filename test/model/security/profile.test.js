'use strict';

const should = require('should');

const {
  Request,
  BadRequestError,
  PreconditionError,
} = require('../../../index');
const Kuzzle = require('../../mocks/kuzzle.mock');
const { Profile } = require('../../../lib/model/security/profile');
const { Role } = require('../../../lib/model/security/role');

describe('Test: model/security/profile', () => {
  const context = {connectionId: null, userId: null};
  const request = new Request(
    {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    },
    context);
  let kuzzle;

  beforeEach(() => {
    kuzzle = new Kuzzle();
  });

  it('should disallow any action when no role be found', () => {
    const profile = new Profile();

    return should(profile.isActionAllowed(request)).be.fulfilledWith(false);
  });

  it('should allow the action if one of the roles allows it', async () => {
    const profile = new Profile();
    const roles = {
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

    profile.optimizedPolicies = [{roleId: 'denyRole'}];

    kuzzle.ask
      .withArgs('core:security:role:get')
      .callsFake(async (event, id) => roles[id]);

    should(await profile.isActionAllowed(request)).be.false();

    profile.optimizedPolicies.push({roleId: 'allowRole'});
    should(await profile.isActionAllowed(request)).be.true();

    profile.optimizedPolicies = [
      {roleId: 'denyRole'},
      {
        roleId: 'allowRole',
        restrictedTo: new Map(Object.entries({
          index2: ['collection1'],
          index3: ['collection1', 'collection2'],
        }))
      }
    ];
    should(await profile.isActionAllowed(request)).be.false();
  });

  it('should retrieve the correct rights list', async () => {
    const profile = new Profile();
    const role1 = new Role();
    const role2 = new Role();
    const role3 = new Role();
    const roles = { role1, role2, role3 };

    role1._id = 'role1';
    role1.controllers = {
      document: {
        actions: { '*': true }
      }
    };

    profile.optimizedPolicies.push({
      roleId: role1._id,
      restrictedTo: new Map(Object.entries(
        {
          index1: ['collection1', 'collection2']
        }
      )),
      
    });

    role2._id = 'role2';
    role2.controllers = {
      document: {
        actions: { delete: true, create: true, update: true }
      }
    };

    profile.optimizedPolicies.push({
      roleId: role2._id,
      restrictedTo: new Map(Object.entries(
        {
          index2: []
        }
      )),
    });

    role3._id = 'role3';
    role3.controllers = {
      document: {
        actions: { get: true, count: true, search: true, create: true }
      }
    };

    profile.constructor._hash = obj => kuzzle.hash(obj);

    profile.optimizedPolicies.push({roleId: role3._id});

    kuzzle.ask
      .withArgs('core:security:role:get')
      .callsFake(async (event, id) => roles[id]);

    let rights = await profile.getRights();
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

  describe('#validateDefinition', () => {
    let profile;

    beforeEach(() => {
      profile = new Profile();
      profile._id = 'test';
      kuzzle.ask.withArgs('core:storage:public:index:exist').resolves(true);
      kuzzle.ask.withArgs('core:storage:public:collection:exist').resolves(true);
    });

    it('should reject if no policies are provided', () => {
      profile.policies = null;

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject if invalid policies are provided', () => {
      profile.policies = 'foo';

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should reject if an empty policies array is provided', () => {
      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, { id: 'api.assert.empty_argument' });
    });

    it('should reject if no roleId is given', () => {
      profile.policies = [{}];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "test.policies[0].roleId".'
        });
    });

    it('should reject if an invalid attribute is given', () => {
      profile.policies = [{ roleId: 'admin', foo: 'bar' }];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.unexpected_argument',
        });
    });

    it('should reject if restrictedTo is not an array', () => {
      profile.policies = [{ roleId: 'admin', restrictedTo: 'bar' }];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type'
        });
    });

    it('should reject if restrictedTo contains a non-object value', () => {
      profile.policies = [{ roleId: 'admin', restrictedTo: [null] }];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type'
        });
    });

    it('should reject if restrictedTo does not contain an index', () => {
      profile.policies = [{ roleId: 'admin', restrictedTo: [{ foo: 'bar' }] }];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument'
        });
    });

    it('should reject if restrictedTo is given an invalid attribute', () => {
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', foo: 'bar' }],
      }];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.unexpected_argument'
        });
    });

    it('should reject if restrictedTo points to an unknown index (strict mode)', async () => {
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index'}]
      }];

      kuzzle.ask.withArgs('core:storage:public:index:exist').resolves(false);

      await profile.validateDefinition();

      await should(profile.validateDefinition({ strict: true }))
        .rejectedWith(PreconditionError, {
          id: 'services.storage.unknown_index',
        });

      should(kuzzle.ask).calledWith('core:storage:public:index:exist', 'index');
    });

    it('should reject if restrictedTo.collections is not an array', () => {
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', collections: 'bar' }]
      }];

      return should(profile.validateDefinition())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type'
        });
    });

    it('should reject if restrictedTo points to an unknown collection (strict mode)', async () => {
      profile.policies = [{
        roleId: 'admin',
        restrictedTo: [{ index: 'index', collections: ['foo']}]
      }];

      kuzzle.ask.withArgs('core:storage:public:collection:exist').resolves(false);

      await profile.validateDefinition();

      await should(profile.validateDefinition({ strict: true }))
        .rejectedWith(PreconditionError, {
          id: 'services.storage.unknown_collection',
        });

      should(kuzzle.ask).calledWith('core:storage:public:collection:exist', 'index', 'foo');
    });

    it('should force the rateLimit to 0 if none is provided', async () => {
      profile.policies = [{roleId: 'admin'}];
      profile.rateLimit = null;
      await profile.validateDefinition();
      should(profile.rateLimit).eql(0);

      profile.rateLimit = undefined;
      await profile.validateDefinition();
      should(profile.rateLimit).eql(0);
    });

    it('should throw if the rate limit is not a valid integer', async () => {
      profile.policies = [{roleId: 'admin'}];

      for (const l of ['foo', {}, [], 123.45, true, false]) {
        profile.rateLimit = l;

        try {
          await profile.validateDefinition();
        }
        catch (e) {
          should(e).instanceOf(BadRequestError);
          should(e.id).eql('api.assert.invalid_type');
        }
      }
    });

    it('should throw if the rate limit is a negative integer', async () => {
      profile.policies = [{roleId: 'admin'}];
      profile.rateLimit = -2;

      try {
        await profile.validateDefinition();
      }
      catch (e) {
        should(e).instanceOf(BadRequestError);
        should(e.id).eql('api.assert.invalid_argument');
      }
    });
  });
});
