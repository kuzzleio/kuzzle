var
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
    profile2,
    user;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    kuzzle = new KuzzleServer();

    profile = new Profile();
    profile._id = 'profile';
    profile.isActionAllowed = sinon.stub().resolves(true);

    profile2 = new Profile();
    profile2._id = 'profile2';
    profile2.isActionAllowed = sinon.stub().resolves(false);

    user = new User();
    user.profilesIds = ['profile', 'profile2'];

    kuzzle.repositories = {
      profile: {
        loadProfile: sinon.stub().resolves(profile),
        loadProfiles: sinon.stub().resolves([profile, profile2])
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
      },
      profileRights2 = {
        rights1: {
          controller: 'read', action: 'get', index: 'foo', collection: 'bar',
          value: 'conditional'
        },
        rights3: {
          controller: 'write', action: 'create', index: 'foo', collection: 'bar',
          value: 'allowed'
        }
      };

    sandbox.stub(user, 'getProfiles').resolves([profile, profile2]);
    sandbox.stub(profile, 'getRights').resolves(profileRights);
    sandbox.stub(profile2, 'getRights').resolves(profileRights2);

    return user.getRights(kuzzle)
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
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'write' &&
                  item.action === 'delete';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('*');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('conditional');

        filteredItem = rights.filter(item => {
          return item.controller === 'write' &&
                  item.action === 'create';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'read' && item.action === 'listIndexes';
        });
        should(filteredItem).length(0);

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
