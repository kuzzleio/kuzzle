var
  _ = require('lodash'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  should = require('should'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  kuzzle = {
    repositories: {},
    services: {list: {}},
    config: require.main.require('lib/config')(params)
  },
  UserRepository = require.main.require('lib/api/core/models/repositories/userRepository')(kuzzle),
  ProfileRepository = require.main.require('lib/api/core/models/repositories/profileRepository')(kuzzle);

describe('Test: repositories/profileRepository', () => {
  var
    mockReadEngine,
    mockRoleRepository,
    mockUserRepository,
    testProfile,
    testProfilePlain,
    errorProfilePlain,
    profileRepository;

  mockReadEngine = {
    get: (requestObject) => {
      var err;
      if (requestObject.data._id === 'testprofile') {
        return q(testProfilePlain);
      }
      if (requestObject.data._id === 'errorprofile') {
        return q(errorProfilePlain);
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return q.reject(err);
    }
  };
  mockRoleRepository = {
    loadRoles: (keys) => {
      if (keys.length === 1 && keys[0] === 'error') {
        return q.reject(new InternalError('Error'));
      }

      return q(keys
        .map((key) => {
          var role = new Role();
          role._id = key;
          return role;
        })
        .filter(role => role._id !== 'notExistingRole')
      );
    }
  };
  mockUserRepository = {
    anonymous: () => {
      return {
        _id: -1,
        name: 'Anonymous',
        profile: 'anonymous'
      };
    }
  };

  before(() => {
    kuzzle.repositories.role = mockRoleRepository;
    kuzzle.repositories.user = mockUserRepository;
  });

  beforeEach(() => {
    profileRepository = new ProfileRepository();

    profileRepository.readEngine = mockReadEngine;

    testProfile = new Profile();
    testProfile._id = 'testprofile';
    testProfile.roles = [];
    testProfile.roles[0] = new Role();
    testProfile.roles[0]._id = 'test';
    testProfile.roles[0].restrictedTo = [{index: 'index'}];
    testProfile.roles[1] = new Role();
    testProfile.roles[1]._id = 'test2';

    testProfilePlain = {
      _id: 'testprofile',
      roles: [
        {_id: 'test', restrictedTo: [{index: 'index'}]},
        {_id: 'test2'}
      ]
    };

    errorProfilePlain = {
      _id: 'errorprofile',
      roles: [ 'error' ]
    };
  });

  describe('#loadProfile', () => {
    it('should return null if the profile does not exist', () => {
      return profileRepository.loadProfile('idontexist')
        .then(result => {
          should(result).be.null();
        });
    });

    it('should reject the promise in case of error', done => {
      profileRepository.loadOneFromDatabase = () => q.reject(new InternalError('Error'));

      should(profileRepository.loadProfile('id')).be.rejectedWith(InternalError);

      delete profileRepository.loadOneFromDatabase;

      done();
    });

    it('should load a profile if already in memory', () => {
      profileRepository.profiles.testprofile = testProfilePlain;
      // we ensure the readEngine is not called
      profileRepository.loadOneFromDatabase = null;
      profileRepository.readEngine = null;

      return profileRepository.loadProfile('testprofile')
        .then(result => {
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);
        });
    });

    it('should load a profile from the db', () => {
      return profileRepository.loadProfile('testprofile')
        .then(function (result) {
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);
        });
    });
  });

  describe('#buildProfileFromRequestObject', () => {
    it('should reject when no id is provided', () => {
      var invalidProfileObject = new RequestObject({
        body: {
          _id: ''
        }
      });

      return should(profileRepository.buildProfileFromRequestObject(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should resolve to a valid Profile when a valid object is provided', () => {
      var validProfileObject = new RequestObject({
        body: testProfilePlain
      });

      return should(profileRepository.buildProfileFromRequestObject(validProfileObject))
        .be.fulfilledWith(testProfilePlain);
    });
  });

  describe('#hydrate', () => {
    it('should reject the promise in case of error', () => {
      return should(profileRepository.loadProfile('errorprofile')).be.rejectedWith(InternalError);
    });

    it('should hydrate a profille with its roles', (done) => {
      var p = new Profile();
      profileRepository.hydrate(p, testProfilePlain)
        .then((result) => {
          should(result.roles[0]).be.an.instanceOf(Role);
          should(result.roles[0]._id).be.equal('test');
          should(result.roles[0].restrictedTo).match([{index: 'index'}]);
          done();
        })
        .catch((error) => {
          done(error);
        });
    });

    it('should throw if the profile contains unexisting roles', () => {
      var p = new Profile();
      return should(profileRepository.hydrate(p, { roles: [{_id: 'notExistingRole' }] })).be.rejectedWith(NotFoundError);
    });
  });

  describe('#deleteProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfileObject = new RequestObject({
        body: {
          _id: ''
        }
      });

      return should(profileRepository.deleteProfile(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should return a raw delete response after deleting', () => {
      var response;

      profileRepository.deleteFromDatabase = id => {
        response = {_id: id};
        return q(response);
      };

      profileRepository.profiles[testProfile._id] = testProfile;
      return should(profileRepository.deleteProfile(testProfile))
        .be.fulfilledWith(response);
    });

    it('should reject when trying to delete admin', () => {
      var profile = {
        _id: 'admin',
        roles: [ {_id: 'admin'} ]
      };

      return should(profileRepository.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete default', () => {
      var profile = {
        _id: 'default',
        roles: [ {_id: 'default'} ]
      };

      return should(profileRepository.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete anonymous', () => {
      var profile = {
        _id: 'anonymous',
        roles: [ {_id: 'anonymous'} ]
      };

      return should(profileRepository.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      return profileRepository.loadProfile('testprofile')
        .then(function (profile) {
          var result = profileRepository.serializeToDatabase(profile);

          should(result).not.be.an.instanceOf(Profile);
          should(result).be.an.Object();
          should(profile._id).be.exactly('testprofile');
          should(result.roles).be.an.Array();
          should(result.roles).have.length(2);
          should(result.roles[0]).be.an.Object();
          should(result.roles[0]).not.be.an.instanceOf(Role);
          should(result.roles[0]._id).be.exactly('test');
          should(result.roles[0].restrictedTo).be.an.Array();
          should(result.roles[1]).be.an.Object();
          should(result.roles[1]).not.be.an.instanceOf(Role);
          should(result.roles[1]._id).be.exactly('test2');
          should(result.roles[1].restrictedTo).be.empty();
        });
    });
  });

  describe('#searchProfiles', () => {
    it('should return a ResponseObject containing an array of profiles', (done) => {
      profileRepository.search = () => {
        return q({
          hits: [{_id: 'test'}],
          total: 1
        });
      };

      profileRepository.searchProfiles([])
        .then(result => {
          should(result).be.an.Object();
          should(result).have.property('hits');
          should(result).have.property('total');
          should(result.hits).be.an.Array();
          should(result.hits[0]).be.an.Object();
          should(result.hits[0]._id).be.exactly('test');

          done();
        })
        .catch(error => done(error));

      delete profileRepository.search;
    });

    it('should properly format the roles filter', (done) => {
      profileRepository.search = (filter) => {
        return q({
          hits: [{_id: 'test'}],
          total: 1,
          filter: filter
        });
      };

      profileRepository.searchProfiles(['role1'])
        .then(result => {
          should(result.filter).have.ownProperty('or');
          should(result.filter.or).be.an.Array();
          should(result.filter.or[0]).have.ownProperty('terms');
          should(result.filter.or[0].terms).have.ownProperty('roles._id');
          should(result.filter.or[0].terms['roles._id']).be.an.Array();
          should(result.filter.or[0].terms['roles._id'][0]).be.exactly('role1');

          done();
        })
        .catch(error => done(error));

      delete profileRepository.search;
    });
  });

  describe('#validateAndSaveProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfile = new Profile();
      invalidProfile._id = '';

      return should(profileRepository.validateAndSaveProfile(invalidProfile))
        .be.rejectedWith(BadRequestError);
    });

    it('should properly persist the profile', () => {
      profileRepository.persistToDatabase = profile => q({_id: profile._id});

      return profileRepository.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(profileRepository.profiles[testProfile._id]).match({roles: [{_id: 'test'}]});
          should(result).be.an.Object();
          should(result._id).be.eql(testProfile._id);
        });
    });

    it('should properly persist the profile with a non object role', () => {
      profileRepository.persistToDatabase = profile => q({_id: profile._id});

      testProfile.roles = ['anonymous'];

      return profileRepository.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(profileRepository.profiles[testProfile._id]).match({roles: [{_id: 'anonymous'}]});
          should(result).be.an.Object();
          should(result._id).be.eql(testProfile._id);
        });
    });
  });

  describe('#defaultRole', () => {
    it('should add the default role when the profile do not have any role set', () => {
      var profile = new Profile();

      profile._id = 'NoRole';
      profileRepository = new ProfileRepository();

      return profileRepository.hydrate(profile, {})
        .then(result => should(result.roles[0]._id).be.eql('default'));
    });
  });
});
