var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  sinon = require('sinon'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

require('sinon-as-promised')(q.Promise);

describe('Test: security/profileTest', function () {
  var
    context = {connection: null, user: null},
    requestObject = {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    },
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should disallow any action when no role be found', () => {
    var profile = new Profile();

    return should(profile.isActionAllowed(requestObject, context)).be.fulfilledWith(false);
  });

  it('should allow the action if one of the roles allows it', () => {
    var
      profile = new Profile(),
      roles = {
        disallowAllRole: new Role(),
        allowActionRole: new Role()
      };

    context = {connection: null, user: null};

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

    profile.policies = [{_id: 'disallowAllRole'}];

    sandbox.stub(kuzzle.repositories.role, 'loadRole', roleId => q(roles[roleId]));

    return profile.isActionAllowed(requestObject, context, kuzzle)
      .then(isAllowed => {
        should(isAllowed).be.false();

        profile.policies.push({_id: 'allowActionRole'});
        return profile.isActionAllowed(requestObject, context, kuzzle);
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

        return profile.isActionAllowed(requestObject, context, kuzzle);
      })
      .then(isAllowed => should(isAllowed).be.false());
  });

  it('should retrieve the good rights list', function () {
    var
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

    profile.policies.push({_id: role1._id, restrictedTo: [{ index: 'index1', collections: ['collection1', 'collection2'] }]});

    role2._id = 'role2';
    role2.controllers = {
      write: {
        actions: { publish: true, create: true, update: true }
      }
    };

    profile.policies.push({_id: role2._id, restrictedTo: [{index: 'index2'}]});

    role3._id = 'role3';
    role3.controllers = {
      read: {
        actions: { get: true, count: true, search: true }
      },
      write: {
        actions: { update: {test: 'return true;'}, create: true, delete: {test: 'return true;'} }
      }
    };
    profile.policies.push({_id: role3._id});

    sandbox.stub(kuzzle.repositories.role, 'loadRole', roleId => q(roles[roleId]));

    return profile.getRights(kuzzle)
      .then(rights => {
        var filteredItem;

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

});
