var
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  should = require('should'),
  Role = require('../../../../../lib/api/core/models/security/role'),
  Profile = require('../../../../../lib/api/core/models/security/profile'),
  ProfileRepository = require('../../../../../lib/api/core/models/repositories/profileRepository'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../../mocks/kuzzle.mock');

describe('Test: repositories/profileRepository', () => {
  var
    kuzzle,
    profileRepository,
    testProfile;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    profileRepository = new ProfileRepository(kuzzle);

    testProfile = new Profile();
    testProfile._id = 'foo';
    testProfile.policies = [
      {roleId: 'test', restrictedTo: [{index: 'index'}]},
      {roleId: 'test2'}
    ];

    return profileRepository.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadProfile', () => {
    it('should reject if no profileid is given', () => {
      return should(profileRepository.loadProfile())
        .be.rejectedWith(BadRequestError, {
          message: 'Missing profileId'
        });
    });

    it('should reject if the profile id is not a string', () => {
      return should(profileRepository.loadProfile({}))
        .be.rejectedWith(BadRequestError, {
          message: 'Invalid argument: Expected profile id to be a string, received "object"'
        });
    });

    it('should return a profile from memory cache', () => {
      var
        p = {foo: 'bar'};
      profileRepository.profiles.foo = p;

      return profileRepository.loadProfile('foo')
        .then(profile => {
          should(profile)
            .be.exactly(p);
        });
    });

    it('should return null if the profile does not exist', () => {
      kuzzle.internalEngine.get.returns(Promise.reject(new NotFoundError('Not found')));

      return profileRepository.loadProfile('idontexist')
        .then(result => {
          should(result).be.null();
        });
    });

    it('should load a profile from the db', () => {
      var p = {foo: 'bar'};

      profileRepository.load = sinon.stub().returns(Promise.resolve(p));

      return profileRepository.loadProfile('foo')
        .then(profile => {
          should(profile)
            .be.exactly(p);
          should(profileRepository.profiles.foo)
            .be.exactly(p);
        });
    });

  });

  describe('#loadProfiles', () => {
    it('should reject if no profileIds are given', () => {
      return should(profileRepository.loadProfiles())
        .be.rejectedWith(BadRequestError, {
          message: 'Missing profileIds'
        });
    });

    it('should reject if profileIds is not an array of strings', () => {
      return should(profileRepository.loadProfiles(['a string', {foo: 'bar'}]))
        .be.rejectedWith(BadRequestError, {
          message: 'An array of strings must be provided as profileIds'
        });
    });

    it('should resolve to an empty array if the input is empty', () => {
      profileRepository.loadProfile = sinon.spy();

      return profileRepository.loadProfiles([])
        .then(result => {
          should(result).eql([]);
          should(profileRepository.loadProfile)
            .have.callCount(0);
        });
    });

    it('should load profiles', () => {
      var
        p1 = {foo: 'bar'},
        p2 = {bar: 'baz'},
        p3 = {baz: 'foo'};

      profileRepository.loadProfile = sinon.stub();

      profileRepository.loadProfile.onCall(0).returns(p1);
      profileRepository.loadProfile.onCall(1).returns(p2);
      profileRepository.loadProfile.onCall(2).returns(p3);

      return profileRepository.loadProfiles(['p1', 'p2', 'p3'])
        .then(result => {
          should(result)
            .eql([p1, p2, p3]);
        });
    });

  });

  describe('#buildProfileFromRequest', () => {
    it('should resolve to a valid Profile when a valid object is provided', () => {
      var
        profile = {
          foo: 'bar'
        },
        request = new Request({
          _id: 'foo',
          body: profile
        });

      return profileRepository.buildProfileFromRequest(request)
        .then(p => should(p).match(profile));
    });
  });

  describe('#hydrate', () => {

    it('should throw if the profile contains unexisting roles', () => {
      var p = new Profile();

      kuzzle.repositories.role.loadRoles.returns(Promise.resolve([]));

      return should(profileRepository.hydrate(p, {
        policies: [
          {roleId: 'notExistingRole'}
          ]
      })).be.rejectedWith(NotFoundError);
    });

    it('should set role default when none is given', () => {
      var p = new Profile();

      kuzzle.repositories.role.loadRoles.returns(Promise.resolve([
        {_id: 'default'}
      ]));

      profileRepository.hydrate(p, {});
      should(p.policies).match([
        {roleId: 'default'}
      ]);
    });

    it('should unnest _source properties', () => {
      var p = new Profile();

      kuzzle.repositories.role.loadRoles.returns(Promise.resolve([
        {_id: 'default'}
      ]));

      profileRepository.hydrate(p, {
        foo: 'bar',
        _source: {
          foo: 'baz'
        }
      });
      should(p.foo).be.exactly('baz');

    });

  });

  describe('#deleteProfile', () => {
    it('should reject when no id is provided', () => {
      var invalidProfileObject = new Request({
        body: {
          _id: ''
        }
      });

      return should(profileRepository.deleteProfile(invalidProfileObject))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject if a user uses the profile about to be deleted', () => {
      kuzzle.repositories.user.search.returns(Promise.resolve({
        total: 1
      }));

      return should(profileRepository.deleteProfile({_id: 'test'})).rejectedWith(ForbiddenError);
    });

    it('should return a raw delete response after deleting', () => {
      var response = {_id: 'testprofile'};

      kuzzle.repositories.user.search.returns(Promise.resolve({}));
      profileRepository.deleteFromCache = sinon.stub().returns(Promise.resolve());
      profileRepository.deleteFromDatabase = sinon.stub().returns(Promise.resolve(response));

      return profileRepository.deleteProfile(testProfile)
        .then(r => {
          should(r)
            .be.exactly(response);
        });
    });

    it('should reject when trying to delete admin', () => {
      var profile = {
        _id: 'admin',
        policies: [ {roleId: 'admin'} ]
      };

      return should(profileRepository.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete default', () => {
      var profile = {
        _id: 'default',
        policies: [ {roleId: 'default'} ]
      };

      return should(profileRepository.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete anonymous', () => {
      var profile = {
        _id: 'anonymous',
        policies: [ {roleId: 'anonymous'} ]
      };

      return should(profileRepository.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      var
        profile = testProfile,
        result;

      profile.getRoles(kuzzle);

      result = profileRepository.serializeToDatabase(profile);


      should(result).not.be.an.instanceOf(Profile);
      should(result).be.an.Object();
      should(profile._id).be.exactly('foo');
      should(result.policies).be.an.Array();
      should(result.policies).have.length(2);
      should(result.policies[0]).be.an.Object();
      should(result.policies[0]).not.be.an.instanceOf(Role);
      should(result.policies[0].roleId).be.exactly('test');
      should(result.policies[0].restrictedTo).be.an.Array();
      should(result.policies[1]).be.an.Object();
      should(result.policies[1]).not.be.an.instanceOf(Role);
      should(result.policies[1].roleId).be.exactly('test2');
      should(result.policies[1]).not.have.property('restrictedRo');
    });
  });

  describe('#searchProfiles', () => {
    it('should call search', () => {
      profileRepository.search = sinon.spy();

      profileRepository.searchProfiles(false, 'from', 'size');
      should(profileRepository.search)
        .be.calledOnce()
        .be.calledWith({query: {}}, 'from', 'size');

      profileRepository.searchProfiles(['role1', 'role2']);
      should(profileRepository.search)
        .be.calledTwice()
        .be.calledWith({query: {
          bool: {
            should: [
              {terms: {'policies.roleId': ['role1']}},
              {terms: {'policies.roleId': ['role2']}}
            ]
          }
      }});
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
      profileRepository.persistToDatabase = sinon.stub();

      return profileRepository.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(result)
            .be.exactly(testProfile);
          should(profileRepository.profiles.foo)
            .be.exactly(testProfile);
        });
    });
  });

});
