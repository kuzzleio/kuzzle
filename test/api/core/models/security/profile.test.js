var
  should = require('should'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

describe('Test: security/profileTest', function () {
  var
    context = {connection: null, user: null},
    requestObject = {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    };

  it('should disallow any action when no role be found', function () {
    var profile = new Profile();

    return should(profile.isActionAllowed(requestObject, context)).be.fulfilledWith(false);
  });

  it('should allow the action if one of the roles allows it', () => {
    var
      context = {connection: null, user: null},
      profile = new Profile(),
      disallowAllRole = new Role(),
      allowActionRole = new Role();

    disallowAllRole.controllers = {
      '*': {
        actions: {
          '*': false
        }
      }
    };

    allowActionRole.controllers = {
      controller: {
        actions: {
          action: true
        }
      }
    };

    profile.roles.push(disallowAllRole);


    return profile.isActionAllowed(requestObject, context)
      .then(isAllowed => {
        should(isAllowed).be.false();

        profile.roles.push(allowActionRole);
        return profile.isActionAllowed(requestObject, context);
      })
      .then(isAllowed => {
        should(isAllowed).be.true();

        allowActionRole.restrictedTo = [
          {index: 'index1'},
          {index: 'index2', collections: ['collection1']},
          {index: 'index3', collections: ['collection1', 'collection2']}
        ];
        return profile.isActionAllowed(requestObject, context);
      })
      .then(isAllowed => should(isAllowed).be.false());
  });

  it('should retrieve the good rights list', function () {
    var
      profile = new Profile(),
      role1 = new Role(),
      role2 = new Role(),
      role3 = new Role();

    role1.controllers = {
      read: {
        actions: { '*': true }
      }
    };
    role1.restrictedTo = [{ index: 'index1', collections: ['collection1', 'collection2'] }];
    profile.roles.push(role1);

    role2.controllers = {
      write: {
        actions: { publish: true, create: true, update: true }
      }
    };
    role2.restrictedTo = [{index: 'index2'}];
    profile.roles.push(role2);

    role3.controllers = {
      read: {
        actions: { get: true, count: true, search: true }
      },
      write: {
        actions: { update: {test: 'return true;'}, create: true, delete: {test: 'return true;'} }
      }
    };
    profile.roles.push(role3);

    return profile.getRights()
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
          return item.controller === 'write' &&
                  item.action === 'publish';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('index2');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'write' &&
                  item.action === 'update';
        });
        should(filteredItem.every(item => {
          return (item.index === '*' && item.collection === '*' && item.value === 'conditional' ) ||
            (item.index === 'index2' && item.collection === '*' && item.value === 'allowed');
        })).be.equal(true);

        filteredItem = rights.filter(item => {
          return item.controller === 'write' &&
                  item.action === 'delete';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('*');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('conditional');

        filteredItem = rights.filter(item => {
          return item.controller === 'read' &&
                  item.action === 'listIndexes';
        });
        should(filteredItem).length(0);

      });
  });

});
