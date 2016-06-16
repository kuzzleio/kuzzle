var
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  should = require('should'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  ForbiddenError = require.main.require('kuzzle-common-objects').Errors.forbiddenError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('sinon-as-promised')(q.Promise);

describe('Test: repositories/profileRepository', () => {
  var
    kuzzle,
    testProfile,
    testProfilePlain = {
      _id: 'testprofile',
      roles: [
        {_id: 'test', restrictedTo: [{index: 'index'}]},
        {_id: 'test2'}
      ]
    },
    errorProfilePlain = {
      _id: 'errorprofile',
      roles: [ 'error' ]
    },
    stubs = {
      profileRepository:{
        loadFromCache: (id, opts) => {
          if (id !== 'testprofile-cached' ) {
            return q(null);
          }
          return q(testProfile);
        }
      },
      roleRepository:{
        loadRoles: (keys) => {
          return q(keys
            .map((key) => {
              var role = new Role();
              role._id = key;
              return role;
            })
          );
        }
      }
    },
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
    .then(() => {
      testProfile = new Profile();
      testProfile._id = 'testprofile';
      testProfile.roles = [];
      testProfile.roles[0] = new Role();
      testProfile.roles[0]._id = 'test';
      testProfile.roles[0].restrictedTo = [{index: 'index'}];
      testProfile.roles[1] = new Role();
      testProfile.roles[1]._id = 'test2';
    });

  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    sandbox.stub(kuzzle.repositories.profile, 'loadFromCache', stubs.profileRepository.loadFromCache);
    sandbox.stub(kuzzle.repositories.profile, 'persistToCache').resolves({});
    sandbox.stub(kuzzle.repositories.profile, 'deleteFromCache').resolves({});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadProfile', () => {
    it('should return null if the profile does not exist', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'get').rejects(new NotFoundError('Not found'));
      return kuzzle.repositories.profile.loadProfile('idontexist')
        .then(result => {
          should(result).be.eql(null);
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
      sandbox.stub(kuzzle.services.list.readEngine, 'get').resolves(testProfilePlain);
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);
      return kuzzle.repositories.profile.loadProfile('testprofile')
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

      return should(kuzzle.repositories.profile.buildProfileFromRequestObject(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should resolve to a valid Profile when a valid object is provided', () => {
      var validProfileObject = new RequestObject({
        body: testProfilePlain
      });

      return should(kuzzle.repositories.profile.buildProfileFromRequestObject(validProfileObject))
        .be.fulfilledWith(testProfilePlain);
    });
  });

  describe('#hydrate', () => {
    it('should reject the promise in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'get').resolves(errorProfilePlain);
      sandbox.stub(kuzzle.repositories.role, 'loadRoles').rejects(new InternalError('Error'));
      return should(kuzzle.repositories.profile.loadProfile('errorprofile')).be.rejectedWith(InternalError);
    });

    it('should hydrate a profille with its roles', () => {
      var p = new Profile();

      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);
      return kuzzle.repositories.profile.hydrate(p, testProfilePlain)
        .then((result) => {
          should(result.roles[0]).be.an.instanceOf(Role);
          should(result.roles[0]._id).be.equal('test');
          should(result.roles[0].restrictedTo).match([{index: 'index'}]);
        });
    });

    it('should throw if the profile contains unexisting roles', () => {
      var p = new Profile();
      sandbox.stub(kuzzle.repositories.role, 'loadRoles').resolves([]);
      return should(kuzzle.repositories.profile.hydrate(p, { roles: [{_id: 'notExistingRole' }] })).be.rejectedWith(NotFoundError);
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
          roles: ['test']
        }
      });

      sandbox.stub(kuzzle.repositories.user.readEngine, 'search').resolves({total: 1, hits: ['test']});

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
        roles: [ {_id: 'admin'} ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete default', () => {
      var profile = {
        _id: 'default',
        roles: [ {_id: 'default'} ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete anonymous', () => {
      var profile = {
        _id: 'anonymous',
        roles: [ {_id: 'anonymous'} ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'get').resolves(testProfilePlain);
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);
      return kuzzle.repositories.profile.loadProfile('testprofile')
        .then(function (profile) {
          var result = kuzzle.repositories.profile.serializeToDatabase(profile);

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
        return q({
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
          should(result.filter.or[0].terms).have.ownProperty('roles._id');
          should(result.filter.or[0].terms['roles._id']).be.an.Array();
          should(result.filter.or[0].terms['roles._id'][0]).be.exactly('role1');
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
      sandbox.stub(kuzzle.repositories.profile, 'persistToDatabase', profile => q({_id: profile._id}));
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);

      return kuzzle.repositories.profile.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(kuzzle.repositories.profile.profiles[testProfile._id]).match({roles: [{_id: 'test'}]});
          should(result).be.an.Object();
          should(result._id).be.eql(testProfile._id);
        });
    });

    it('should properly persist the profile with a non object role', () => {
      sandbox.stub(kuzzle.repositories.profile, 'persistToDatabase', profile => q({_id: profile._id}));
      sandbox.stub(kuzzle.repositories.role, 'loadRoles', stubs.roleRepository.loadRoles);

      testProfile.roles = ['anonymous'];

      return kuzzle.repositories.profile.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(kuzzle.repositories.profile.profiles[testProfile._id]).match({roles: [{_id: 'anonymous'}]});
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
        .then(result => should(result.roles[0]._id).be.eql('default'));
    });
  });
});
