var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user');


describe('Test: security/userTest', () => {
  var
    kuzzle,
    sandbox,
    profile,
    user;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    kuzzle = new KuzzleServer();

    profile = new Profile();
    profile._id = 'profile';
    profile.isActionAllowed = sinon.stub().resolves(true);
    profile._id = 'profile';

    user = new User();
    user.profilesIds = ['profile'];

    kuzzle.repositories = {
      profile: {
        loadProfile: sinon.stub().resolves(profile),
        loadProfiles: sinon.stub().resolves([profile])
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

    sandbox.stub(user, 'getProfiles').resolves([profile]);
    sandbox.stub(profile, 'getRights').resolves(profileRights);

    return user.getRights(kuzzle)
      .then(rights => {
        should(rights).be.an.Object();
        should(rights).match(profileRights);
      });
  });

  it('should retrieve the profile', () => {
    return user.getProfiles(kuzzle)
      .then(p => {
        should(p).be.an.Array();
        should(p[0]).be.an.Object();
        should(p[0]).be.exactly(profile);
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

  it('should respond false if the user have no profileIds', () => {
    user.profilesIds = [];
    return user.isActionAllowed({}, {}, kuzzle)
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.false();
        should(profile.isActionAllowed.called).be.false();
      });
  });

  it('should rejects if the loadProfiles throws an error', () => {
    sandbox.stub(user, 'getProfiles').rejects('error');
    return should(user.isActionAllowed({}, {}, kuzzle)).be.rejectedWith('error');
  });
});
