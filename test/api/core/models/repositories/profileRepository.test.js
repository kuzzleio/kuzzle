var
  params = require('rc')('kuzzle'),
  should = require('should'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
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
    testProfile,
    testProfilePlain,
    errorProfilePlain,
    profileRepository;

  mockReadEngine = {
    get: function (requestObject) {
      var err;

      if (requestObject.data._id === 'testprofile') {
        return Promise.resolve(new ResponseObject(requestObject, testProfilePlain));
      }
      if (requestObject.data._id === 'errorprofile') {
        return Promise.resolve(new ResponseObject(requestObject, errorProfilePlain));
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return Promise.resolve(err);
    }
  };
  mockRoleRepository = {
    loadRoles: function (keys) {
      if (keys.length === 1 && keys[0] === 'error') {
        return Promise.reject(new InternalError('Error'));
      }
      return Promise.resolve(keys.map(function (key) {
        var role = new Role();
        role._id = key;
        return role;
      }));
    }
  };

  before(function () {
    kuzzle.repositories.role = mockRoleRepository;
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
        return Promise.reject(new InternalError('Error'));
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

  describe('#hydrate', () => {
    it('should reject the promise in case of error', () => {
      return should(profileRepository.loadProfile('errorprofile')).be.rejectedWith(InternalError);
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
});
