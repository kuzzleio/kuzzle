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

  it('should allow the action if one of the roles allows it', function (callback) {
    var
      context = {connection: null, user: null},
      profile = new Profile(),
      disallowAllRole = new Role(),
      allowActionRole = new Role();

    disallowAllRole.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': false
                }
              }
            }
          }
        }
      }
    };

    allowActionRole.indexes = {
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
    };

    profile.roles.push(disallowAllRole);


    profile.isActionAllowed(requestObject, context)
      .then(isAllowed => {
        should(isAllowed).be.false();

        profile.roles.push(allowActionRole);
        return profile.isActionAllowed(requestObject, context);
      })
      .then(isAllowed => {
        should(isAllowed).be.true();
        callback();
      });
  });

});
