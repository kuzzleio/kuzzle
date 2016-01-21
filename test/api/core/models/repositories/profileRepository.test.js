var
  params = require('rc')('kuzzle'),
  q = require('q'),
  should = require('should'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  UserRepository = require.main.require('lib/api/core/models/repositories/userRepository'),
  kuzzle = {
    repositories: {},
    services: {list: {}},
    config: require.main.require('lib/config')(params)
  },
  ProfileRepository = require.main.require('lib/api/core/models/repositories/profileRepository')(kuzzle);

describe('Test: repositories/profileRepository', function () {
  var
    mockReadEngine,
    mockRoleRepository,
    mockSearch,
    testProfile,
    testProfilePlain,
    errorProfilePlain,
    profileRepository;

  mockReadEngine = {
    get: function (requestObject) {
      var err;

      if (requestObject.data._id === 'testprofile') {
        return q(new ResponseObject(requestObject, testProfilePlain));
      }
      if (requestObject.data._id === 'errorprofile') {
        return q(new ResponseObject(requestObject, errorProfilePlain));
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return q(err);
    }
  };
  mockRoleRepository = {
    loadRoles: function (keys) {
      if (keys.length === 1 && keys[0] === 'error') {
        return q.reject(new InternalError('Error'));
      }

      return q(keys.map(function (key) {
        var role = new Role();
        role._id = key;
        return role;
      })
      .filter((role) => {
        return role._id !== 'notExistingRole';
      })
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

  before(function () {
    kuzzle.repositories.role = mockRoleRepository;
    kuzzle.repositories.user = mockUserRepository;
  });

  beforeEach(function () {
    profileRepository = new ProfileRepository();
    profileRepository.readEngine = mockReadEngine;

    testProfile = new Profile();
    testProfile._id = 'testprofile';
    testProfile.roles = [];
    testProfile.roles[0] = new Role();
    testProfile.roles[0]._id = 'test';

    testProfilePlain = {
      _id: 'testprofile',
      roles: [ 'test' ]
    };

    errorProfilePlain = {
      _id: 'errorprofile',
      roles: [ 'error' ]
    };
  });

  describe('#loadProfile', () => {
    it('should return null if the profile does not exist', done => {
      profileRepository.loadProfile('idontexist')
        .then(result => {
          should(result).be.null();

          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should reject the promise in case of error', done => {
      profileRepository.loadOneFromDatabase = () => {
        return q.reject(new InternalError('Error'));
      };

      should(profileRepository.loadProfile('id')).be.rejectedWith(InternalError);

      delete profileRepository.loadOneFromDatabase;

      done();
    });

    it('should load a profile if already in memory', done => {
      profileRepository.profiles.testprofile = testProfile;
      // we ensure the readEngine is not called
      profileRepository.loadOneFromDatabase = null;
      profileRepository.readEngine = null;

      profileRepository.loadProfile('testprofile')
        .then(function (result){
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should load a profile defined in kuzzle params if not in db', done => {
      profileRepository.loadProfile('anonymous')
        .then(function (result) {
          should(result).be.an.instanceOf(Profile);
          should(result._id).be.exactly('anonymous');
          should(result.roles).be.an.Array();
          should(result.roles).not.be.empty();

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should load a profile from the db', done => {
      profileRepository.loadProfile('testprofile')
        .then(function (result) {
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);

          done();
        })
        .catch(function (error) {
          done(error);
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

      should(profileRepository.buildProfileFromRequestObject(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should resolve to a valid Profile when a valid object is provided', () => {
      var validProfileObject = new RequestObject({
        body: testProfilePlain
      });

      should(profileRepository.buildProfileFromRequestObject(validProfileObject))
        .be.fulfilledWith(Profile);
    });
  });

  describe('#hydrate', () => {
    it('should reject the promise in case of error', () => {
      return should(profileRepository.loadProfile('errorprofile')).be.rejectedWith(InternalError);
    });
    it('should throw if the profile contains unexisting roles', () => {
      var p = new Profile();
      return should(profileRepository.hydrate(
        p, { roles: ['notExistingRole'] }
      )).be.rejectedWith(NotFoundError);
    });
  });

  describe('#deleteProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfileObject = new RequestObject({
        body: {
          _id: ''
        }
      });

      should(profileRepository.deleteProfile(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should return a ResponseObject after deleting', () => {
      profileRepository.deleteFromDatabase = id => {
        return q(new ResponseObject({
          body: {
            _id: id
          }
        }));
      };

      profileRepository.profiles[testProfile._id] = testProfile;
      should(profileRepository.deleteProfile(testProfile))
        .be.fulfilledWith(ResponseObject);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', done => {
      profileRepository.loadProfile('testprofile')
        .then(function (profile) {
          var result = profileRepository.serializeToDatabase(profile);

          should(result).not.be.an.instanceOf(Profile);
          should(result).be.an.Object();
          should(profile._id).be.exactly('testprofile');
          should(result.roles).be.an.Array();
          should(result.roles).have.length(1);
          should(result.roles[0]).be.exactly('test');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#searchProfiles', () => {
    it('should return a ResponseObject containing an array of profiles', (done) => {
      profileRepository.search = () => {
        return q(new ResponseObject({}, {
          hits: [{_id: 'test'}],
          total: 1
        }));
      };

      profileRepository.searchProfiles([])
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');

          done();an.instanceOf(ResponseObject);
          done(error);
        });

      delete profileRepository.search;
    });

    it('should properly format the roles filter', (done) => {
      profileRepository.search = (filter) => {
        return q(new ResponseObject({}, {
          hits: [{_id: 'test'}],
          total: 1,
          filter: filter
        }));
      };

      profileRepository.searchProfiles(['role1'])
        .then(result => {
          var jsonResponse = result.toJson();

          should(jsonResponse.result.filter).have.ownProperty('or');
          should(jsonResponse.result.filter.or).be.an.Array();
          should(jsonResponse.result.filter.or[0]).have.ownProperty('terms');
          should(jsonResponse.result.filter.or[0].terms).have.ownProperty('roles');
          should(jsonResponse.result.filter.or[0].terms.roles).be.an.Array();
          should(jsonResponse.result.filter.or[0].terms.roles[0]).be.exactly('role1');

          done();
        })
        .catch(error => {
          done(error);
        });

      delete profileRepository.search;
    });
  });

  describe('#validateAndSaveProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfile = new Profile();
      invalidProfile._id = '';

      should(profileRepository.validateAndSaveProfile(invalidProfile))
        .be.rejectedWith(BadRequestError);
    });

    it('should properly persist the profile', () => {
      profileRepository.persistToDatabase = (profile) => {
        return q(new ResponseObject({}, {
          body: {
            _id: profile._id
          }
        }));
      };

      profileRepository.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(profileRepository.profiles[testProfile._id]).be.eql(testProfile);
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.eql(testProfile._id);
        });
    });
  });
});
