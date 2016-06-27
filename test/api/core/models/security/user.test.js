var
  q = require('q'),
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  kuzzle = new Kuzzle(),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user');

require('sinon-as-promised')(q.Promise);

describe('Test: security/userTest', function () {
  var
    sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should retrieve the good rights list', function () {
    var
      profile = new Profile(),
      user = new User(),
      profileRights = {
        rights1: {
          controller: 'read', action: 'get', index: 'foo', collection: 'bar',
          value: 'allowed'
        },
        rights2: {
          controller: 'write', action: 'delete', index: '*', collection: '*',
          value: 'conditional'
        }
      };

    sandbox.stub(user, 'getProfile').resolves(profile);
    sandbox.stub(profile, 'getRights').resolves(profileRights);

    return user.getRights(kuzzle)
      .then(rights => {
        should(rights).be.an.Object();
        should(rights).be.exactly(profileRights);
      });
  });

});
