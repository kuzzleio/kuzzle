var
  q = require('q'),
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user');

require('sinon-as-promised')(q.Promise);

describe('Test: security/userTest', () => {
  var
    kuzzle,
    sandbox,
    profile = new Profile(),
    user = new User();

  profile._id = 'profile';
  profile.isActionAllowed = sinon.stub().resolves(true);
  profile._id = 'profile';
  user.profile = 'profile';

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    kuzzle = new Kuzzle();
    kuzzle.repositories = {
      profile: {
        loadProfile: sinon.stub().resolves(profile)
      }
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should retrieve the good rights list', () => {
    var
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

  it('should retrieve the profile', () => {
    return user.getProfile(kuzzle)
      .then(p => {
        should(p).be.an.Object();
        should(p).be.exactly(profile);
      });
  });

  it('should use the isActionAlloed method from its profile', () => {
    return user.isActionAllowed({}, {}, kuzzle)
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.true();
        should(profile.isActionAllowed.called).be.true();
      });
  });

});
