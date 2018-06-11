const
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require('../../../../../lib/api/kuzzle'),
  Profile = require('../../../../../lib/api/core/models/security/profile'),
  User = require('../../../../../lib/api/core/models/security/user'),
  Request = require('kuzzle-common-objects').Request;

const
  _kuzzle = Symbol.for('_kuzzle');

describe('Test: security/userTest', () => {
  let
    kuzzle,
    profile,
    profile2,
    user;

  beforeEach(() => {
    kuzzle = new Kuzzle();

    profile = new Profile();
    profile._id = 'profile';
    profile.isActionAllowed = sinon.stub().resolves(true);

    profile2 = new Profile();
    profile2._id = 'profile2';
    profile2.isActionAllowed = sinon.stub().resolves(false);

    user = new User();
    user.profileIds = ['profile', 'profile2'];

    kuzzle.repositories = {
      profile: {
        loadProfile: sinon.stub().resolves(profile),
        loadProfiles: sinon.stub().resolves([profile, profile2])
      }
    };
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

    sinon.stub(user, 'getProfiles').resolves([profile, profile2]);
    sinon.stub(profile, 'getRights').resolves(profileRights);
    sinon.stub(profile2, 'getRights').resolves(profileRights2);

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
    user[_kuzzle] = kuzzle;

    return user.getProfiles()
      .then(p => {
        should(p).be.an.Array();
        should(p[0]).be.an.Object();
        should(p[0]).be.exactly(profile);
      });
  });

  it('should use the isActionAllowed method from its profile', () => {
    user[_kuzzle] = kuzzle;
    return user.isActionAllowed(new Request({}))
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.true();
        should(profile.isActionAllowed).be.called();
      });
  });

  it('should respond false if the user have no profileIds', () => {
    user.profileIds = [];
    return user.isActionAllowed(new Request({}))
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.false();
        should(profile.isActionAllowed).not.be.called();
      });
  });

  it('should rejects if the loadProfiles throws an error', () => {
    sinon.stub(user, 'getProfiles').rejects(new Error('error'));
    return should(user.isActionAllowed(new Request({}))).be.rejectedWith('error');
  });
});
