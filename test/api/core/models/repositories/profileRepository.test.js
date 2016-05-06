var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

require('sinon-as-promised')(q.Promise);

describe('Test: repositories/kuzzle.repositories.profile', () => {
  var
    kuzzle,
    sandbox,
    testUserPlain,
    testProfile,
    testProfilePlain,
    errorProfilePlain;

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    testUserPlain = {
      _id: 'testUser',
      profile: 'testProfile'
    };

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
    sandbox.mock(kuzzle.repositories.profile, 'readEngine', {
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
    });

    sandbox.stub(kuzzle.repositories.role, 'loadRoles', (keys) => {
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
    });

    sandbox.mock(kuzzle.repositories.user, 'anonymous', () => {
      return {
        _id: -1,
        name: 'Anonymous',
        profile: 'anonymous'
      };
    });

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadProfile', () => {
    it('should return null if the profile does not exist', () => {
      return kuzzle.repositories.profile.loadProfile('idontexist')
        .then(result => {
          should(result).be.null();
        });
    });

    it('should reject the promise in case of error', done => {
      sandbox.stub(kuzzle.repositories.profile, 'loadOneFromDatabase').rejects(new InternalError('Error'));

      should(kuzzle.repositories.profile.loadProfile('id')).be.rejectedWith(InternalError);

      kuzzle.repositories.profile.loadOneFromDatabase.restore();

      done();
    });

    it('should load a profile if already in memory', () => {
      kuzzle.repositories.profile.profiles.testprofile = testProfilePlain;
      // we ensure the readEngine is not called
      sandbox.spy(kuzzle.repositories.profile, 'loadOneFromDatabase');
      sandbox.spy(kuzzle.repositories.profile.readEngine, 'get');

      return kuzzle.repositories.profile.loadProfile('testprofile')
        .then(result => {
          should(result).be.an.instanceOf(Profile);
          should(result).be.eql(testProfile);
          should(kuzzle.repositories.profile.loadOneFromDatabase.called).be.false();
          should(kuzzle.repositories.profile.readEngine.get.called).be.false();
        });
    });

    it('should load a profile from the db', () => {
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

      return kuzzle.repositories.profile.buildProfileFromRequestObject(validProfileObject)
        .then(response => should(response).be.instanceOf(Profile));
    });
  });

  describe('#hydrate', () => {
    it('should reject the promise in case of error', () => {
      return should(kuzzle.repositories.profile.hydrate('errorprofile', {})).be.rejected();
    });

    it('should throw if the profile contains unexisting roles', (done) => {
      var p = new Profile();

      kuzzle.repositories.profile.hydrate(p, { roles: ['notExistingRole'] })
        .then(() => done('Returned non-error'))
        .catch((error) => {
          should(error).be.an.instanceOf(NotFoundError);
          done();
        });
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

    it('should return a raw delete response after deleting', () => {
      var response, id;

      id = 'testprofile';
      response = {id: id};

      sandbox.stub(kuzzle.repositories.profile, 'deleteFromDatabase').resolves(response);

      sandbox.stub(kuzzle.repositories.profile.profiles, testProfile._id, testProfile);

      return should(kuzzle.repositories.profile.deleteProfile(testProfile))
        .be.fulfilledWith(response);
    });

    it('should reject when trying to delete admin', () => {
      var profile = {
        _id: 'admin',
        roles: [ 'admin' ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete default', () => {
      var profile = {
        _id: 'default',
        roles: [ 'default' ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete anonymous', () => {
      var profile = {
        _id: 'anonymous',
        roles: [ 'anonymous' ]
      };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject when trying to delete a still in use profile', () => {
      var profile = {
        _id: 'anonymous',
        roles: [ 'anonymous' ]
      };

      sandbox.stub(kuzzle.repositories.profile.readEngine, 'search').resolves({total: 1});

      // mockReadEngine.search = (requestObject) => {
      //     return q({total: 1});
      // };

      return should(kuzzle.repositories.profile.deleteProfile(profile))
        .be.rejectedWith(BadRequestError);
    });

  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      return kuzzle.repositories.profile.loadProfile('testprofile')
        .then(function (profile) {
          var result = kuzzle.repositories.profile.serializeToDatabase(profile);

          should(result).not.be.an.instanceOf(Profile);
          should(result).be.an.Object();
          should(profile._id).be.exactly('testprofile');
          should(result.roles).be.an.Array();
          should(result.roles).have.length(1);
          should(result.roles[0]).be.exactly('test');
        });
    });
  });

  describe('#searchProfiles', () => {
    it('should return a ResponseObject containing an array of profiles', (done) => {
      sandbox.stub(kuzzle.repositories.profile.readEngine, 'search').resolves({
          hits: [{_id: 'test'}],
          total: 1
      });

      kuzzle.repositories.profile.searchProfiles([])
        .then(result => {
          should(result).be.an.Object();
          should(result).have.property('hits');
          should(result).have.property('total');
          should(result.hits).be.an.Array();
          should(result.hits[0]._id).be.exactly('test');

          done();
        })
        .catch(error => done(error));

      delete kuzzle.repositories.profile.search;
    });

    it('should properly format the roles filter', (done) => {
      kuzzle.repositories.profile.search = (filter) => {
        return q({
          hits: [{_id: 'test'}],
          total: 1,
          filter: filter
        });
      };

      kuzzle.repositories.profile.searchProfiles(['role1'])
        .then(result => {
          should(result.filter).have.ownProperty('or');
          should(result.filter.or).be.an.Array();
          should(result.filter.or[0]).have.ownProperty('terms');
          should(result.filter.or[0].terms).have.ownProperty('roles');
          should(result.filter.or[0].terms.roles).be.an.Array();
          should(result.filter.or[0].terms.roles[0]).be.exactly('role1');

          done();
        })
        .catch(error => done(error));

      delete kuzzle.repositories.profile.search;
    });
  });

});  