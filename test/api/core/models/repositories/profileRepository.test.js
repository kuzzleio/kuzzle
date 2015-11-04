var
  params = require('rc')('kuzzle'),
  should = require('should'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
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
    profileRepository;

  mockReadEngine = {
    get: function (requestObject) {
      var err;

      if (requestObject.data._id === 'testprofile') {
        return Promise.resolve(new ResponseObject(requestObject, testProfilePlain));
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return Promise.resolve(err);
    }
  };
  mockRoleRepository = {
    loadRoles: function (keys) {
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
  });

  describe('#loadProfile', function () {
    it('should load a profile if already in memory', function (done) {
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

    it('should load a profile defined in kuzzle params if not in db', function (done) {
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

    it('should load a profile from the db', function (done) {
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

  describe('#serializeToDB', function () {
    it('should return a plain flat object', function (done) {
      profileRepository.loadProfile('testprofile')
        .then(function (profile) {
          var result = profileRepository.serializeToDB(profile);

          should(result).not.be.an.instanceOf(Profile);
          should(result).be.an.Object();
          should(result._id).be.exactly('testprofile');
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
