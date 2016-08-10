var
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  should = require('should'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  ForbiddenError = require.main.require('kuzzle-common-objects').Errors.forbiddenError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: repositories/profileRepository', () => {
  var
    kuzzle,
    testProfile,
    testProfilePlain = {
      _id: 'testprofile',
      policies: [
        {roleId: 'test', restrictedTo: [{index: 'index'}]},
        {roleId: 'test2'}
      ]
    },
    stubs = {
      profileRepository:{
        loadFromCache: (id) => {
          if (id !== 'testprofile-cached') {
            return Promise.resolve(null);
          }
          return Promise.resolve(testProfile);
        }
      },
      roleRepository:{
        loadRoles: (keys) => {
          return Promise.resolve(keys
            .map((key) => {
              var role = new Role();
              role._id = key;
              return role;
            })
          );
        }
      }
    };

  before(() => {
    kuzzle = new Kuzzle();
    testProfile = new Profile();
    testProfile._id = testProfilePlain._id;
    testProfile.policies = testProfilePlain.policies;
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(()=> kuzzle.repositories.init())
      .then(() => {
        sandbox.stub(kuzzle.repositories.profile, 'loadFromCache', stubs.profileRepository.loadFromCache);
        sandbox.stub(kuzzle.repositories.profile, 'persistToCache').resolves({});
        sandbox.stub(kuzzle.repositories.profile, 'deleteFromCache').resolves({});
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadProfile', () => {
    it('should return null if the profile does not exist', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'get').rejects(new NotFoundError('Not found'));
      return kuzzle.repositories.profile.loadProfile('idontexist')
        .then(result => {
          should(result).be.null();
        });
    });

    it('should reject the promise in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadOneFromDatabase').rejects(new InternalError('Error'));
      return should(kuzzle.repositories.profile.loadProfile('id')).be.rejectedWith(InternalError);
    });

    it('should load a profile from cache if present', () => {
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);
      sandbox.stub(kuzzle.repositories.profile, 'refreshCacheTTL').resolves({});

      return kuzzle.repositories.profile.loadProfile('testprofile-cached')
        .then(result => {
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);
        });
    });

    it('should load a profile from the db', () => {
      kuzzle.internalEngine.get.restore();
      sandbox.stub(kuzzle.internalEngine, 'get').resolves(testProfilePlain);
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);
      return kuzzle.repositories.profile.loadProfile('testprofile')
        .then(result => {
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);
        });
    });

    it('should raise an error if the given parameter is a Profile object', () => {
      var profileObject = new Profile();
      profileObject._id = 'testprofile';

      return should(kuzzle.repositories.profile.loadProfile(profileObject)).be.rejectedWith('A profileId must be provided');
    });
  });

  describe('#loadProfiles', () => {
    it('should not load a not existing profile', () => {
      var
        existingProfile = new Profile(),
        stub;

      kuzzle.internalEngine.get.restore();
      stub = sandbox.stub(kuzzle.internalEngine, 'get');

      existingProfile._id = 'existingProfile';
      stub.onCall(0).rejects(new NotFoundError('Not found'));
      stub.onCall(1).resolves(existingProfile);

      return kuzzle.repositories.profile.loadProfiles(['idontexist', 'existingProfile'])
        .then(result => {
          should(result).be.an.Array();
          should(result.length).be.eql(1);
          should(result[0]._id).be.eql('existingProfile');
        });
    });

    it('should rejects when no profileIds is given', () => {
      return should(kuzzle.repositories.profile.loadProfiles()).be.rejectedWith('Missing profilesIds');
    });

    it('should rejects when no profileIds is not an Array', () => {
      return should(kuzzle.repositories.profile.loadProfiles(42)).be.rejectedWith('An array of strings must be provided as profilesIds');
    });

    it('should respond with an emty array when profileIds is an empty array', () => {
      return kuzzle.repositories.profile.loadProfiles([])
        .then(response => {
          should(response).be.an.Array();
          should(response).be.eql([]);
        });
    });

    it('should rejects when profileIds contains some non string entry', () => {
      return should(kuzzle.repositories.profile.loadProfiles([12])).be.rejectedWith('An array of strings must be provided as profilesIds');
    });
  });

  describe('#buildProfileFromRequestObject', () => {
    it('should reject when no id is provided', () => {
      var invalidProfileObject = new RequestObject({
        body: {
          _id: ''
        }
      });

      return should(kuzzle.repositories.profile.buildProfileFromRequestObject(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should resolve to a valid Profile when a valid object is provided', () => {
      var validProfileObject = new RequestObject({
        body: testProfilePlain
      });

      return kuzzle.repositories.profile.buildProfileFromRequestObject(validProfileObject)
        .then(profile => should(profile).match(testProfilePlain));
    });
  });

  describe('#hydrate', () => {
    it('should reject the promise in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'load').rejects(new InternalError('Error'));
      return should(kuzzle.repositories.profile.loadProfile('errorprofile')).be.rejectedWith(InternalError);
    });

    it('should throw if the profile contains unexisting roles', () => {
      var p = new Profile();
      sandbox.stub(kuzzle.repositories.role, 'loadRoles').resolves([]);
      return should(kuzzle.repositories.profile.hydrate(p, { policies: [{roleId: 'notExistingRole' }] })).be.rejectedWith(NotFoundError);
    });
  });

  describe('#deleteProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfileObject = new RequestObject({
        body: {
          _id: ''
        }
      });

      return should(kuzzle.repositories.profile.deleteProfile(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject if a user uses the profile about to be deleted', () => {
      sandbox.stub(kuzzle.repositories.profile, 'profiles', {
        'test': {
          _id: 'test',
          policies: [{roleId:'test'}]
        }
      });

      sandbox.stub(kuzzle.internalEngine, 'search').resolves({total: 1, hits: ['test']});

      return should(kuzzle.repositories.profile.deleteProfile({_id: 'test'})).rejectedWith(ForbiddenError);
    });

    it('should return a raw delete response after deleting', () => {
      var response = {_id: 'testprofile'};

      sandbox.stub(kuzzle.repositories.profile, 'deleteFromDatabase').resolves(response);
      sandbox.stub(kuzzle.repositories.user, 'search').resolves({total: 0});

      return should(kuzzle.repositories.profile.deleteProfile(testProfile))
        .be.fulfilledWith(response);
    });

    it('should reject when trying to delete admin', () => {
      var profile = {
        _id: 'admin',
        policies: [ {roleId: 'admin'} ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete default', () => {
      var profile = {
        _id: 'default',
        policies: [ {roleId: 'default'} ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete anonymous', () => {
      var profile = {
        _id: 'anonymous',
        policies: [ {roleId: 'anonymous'} ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      sandbox.stub(kuzzle.repositories.profile, 'load').resolves(testProfilePlain);
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);
      return kuzzle.repositories.profile.loadProfile('testprofile')
        .then(profile => {
          var result = kuzzle.repositories.profile.serializeToDatabase(profile);
          should(result).not.be.an.instanceOf(Profile);
          should(result).be.an.Object();
          should(profile._id).be.exactly('testprofile');
          should(result.policies).be.an.Array();
          should(result.policies).have.length(2);
          should(result.policies[0]).be.an.Object();
          should(result.policies[0]).not.be.an.instanceOf(Role);
          should(result.policies[0].roleId).be.exactly('test');
          should(result.policies[0].restrictedTo).be.an.Array();
          should(result.policies[1]).be.an.Object();
          should(result.policies[1]).not.be.an.instanceOf(Role);
          should(result.policies[1].roleId).be.exactly('test2');
          should(result.policies[1].restrictedTo).be.empty();
        });
    });
  });

  describe('#searchProfiles', () => {
    it('should return a ResponseObject containing an array of profiles', () => {
      sandbox.stub(kuzzle.repositories.profile, 'search').resolves({
        hits: [{_id: 'test'}],
        total: 1
      });

      return kuzzle.repositories.profile.searchProfiles([])
        .then(result => {
          should(result).be.an.Object();
          should(result).have.property('hits');
          should(result).have.property('total');
          should(result.hits).be.an.Array();
          should(result.hits[0]).be.an.Object();
          should(result.hits[0]._id).be.exactly('test');

        });
    });

    it('should properly format the roles filter', () => {
      sandbox.stub(kuzzle.repositories.profile, 'search', (filter) => {
        return Promise.resolve({
          hits: [{_id: 'test'}],
          total: 1,
          filter: filter
        });
      });

      return kuzzle.repositories.profile.searchProfiles(['role1'])
        .then(result => {
          should(result.filter).have.ownProperty('or');
          should(result.filter.or).be.an.Array();
          should(result.filter.or[0]).have.ownProperty('terms');
          should(result.filter.or[0].terms).have.ownProperty('policies.roleId');
          should(result.filter.or[0].terms['policies.roleId']).be.an.Array();
          should(result.filter.or[0].terms['policies.roleId'][0]).be.exactly('role1');
        });
    });
  });

  describe('#validateAndSaveProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfile = new Profile();
      invalidProfile._id = '';

      return should(kuzzle.repositories.profile.validateAndSaveProfile(invalidProfile))
        .be.rejectedWith(BadRequestError);
    });

    it('should properly persist the profile', () => {
      sandbox.stub(kuzzle.repositories.profile, 'persistToDatabase', profile => Promise.resolve({_id: profile._id}));
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);

      return kuzzle.repositories.profile.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(kuzzle.repositories.profile.profiles[testProfile._id]).match({policies: [{roleId: 'test'}]});
          should(result).be.an.Object();
          should(result._id).be.eql(testProfile._id);
        });
    });

    it('should properly persist the profile with a non object role', () => {
      sandbox.stub(kuzzle.repositories.profile, 'persistToDatabase', profile => Promise.resolve({_id: profile._id}));
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);

      testProfile.policies = [{roleId: 'anonymous'}];

      return kuzzle.repositories.profile.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(kuzzle.repositories.profile.profiles[testProfile._id]).match({policies: [{roleId: 'anonymous'}]});
          should(result).be.an.Object();
          should(result._id).be.eql(testProfile._id);
        });
    });
  });

  describe('#defaultRole', () => {
    it('should add the default role when the profile do not have any role set', () => {
      var profile = new Profile();

      profile._id = 'NoRole';
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);

      return kuzzle.repositories.profile.hydrate(profile, {})
        .then(result => should(result.policies[0].roleId).be.eql('default'));
    });
  });
});
