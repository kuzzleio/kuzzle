'use strict';

const sinon = require('sinon');
const should = require('should');
const Role = require('../../../lib/core/security/document/role');
const Profile = require('../../../lib/core/security/document/profile');
const ProfileRepository = require('../../../lib/core/security/profileRepository');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const {
  Request,
  errors: {
    BadRequestError,
    PreconditionError,
    NotFoundError,
    InternalError
  }
} = require('kuzzle-common-objects');

const _kuzzle = Symbol.for('_kuzzle');

describe('Test: security/profileRepository', () => {
  let
    kuzzle,
    profileRepository,
    testProfile;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    profileRepository = new ProfileRepository(kuzzle);

    testProfile = new Profile();
    testProfile[_kuzzle] = kuzzle;
    testProfile._id = 'foo';
    testProfile.policies = [
      {roleId: 'test', restrictedTo: [{index: 'index'}]},
      {roleId: 'test2'}
    ];

    return profileRepository.init({ indexStorage: kuzzle.internalIndex });
  });

  describe('#load', () => {
    it('should reject if no profileid is given', () => {
      return should(profileRepository.load())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "profileId".'
        });
    });

    it('should reject if the profile id is not a string', () => {
      return should(profileRepository.load({}))
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "profileId" (expected: string)'
        });
    });

    it('should return a profile from memory cache', () => {
      const p = {foo: 'bar'};
      profileRepository.profiles.set('foo', p);

      return profileRepository.load('foo')
        .then(profile => {
          should(profile).be.exactly(p);
        });
    });

    it('should reject if the profile does not exist', () => {
      profileRepository.indexStorage.get.rejects(new NotFoundError('Not found'));

      return should(profileRepository.load('idontexist'))
        .rejectedWith(NotFoundError, { id: 'security.profile.not_found' });
    });

    it('should load a profile from the db', () => {
      const p = {foo: 'bar', constructor: {_hash: () => false}};

      // ProfileRepository
      const proto = Object.getPrototypeOf(profileRepository);
      // Repository
      const parent = Object.getPrototypeOf(proto);

      sinon.stub(parent, 'load').resolves(p);

      kuzzle.repositories.role.loadRoles.resolves([{_id: 'default'}]);

      return profileRepository.load('foo')
        .then(profile => {
          should(profile).be.exactly(p);
          should(profileRepository.profiles).have.value('foo', p);

          // important! for a reason I don't explain, invalidating require cache is not good enough
          parent.load.restore();
        });
    });

  });

  describe('#loadProfiles', () => {
    it('should reject if no profileIds are given', () => {
      return should(profileRepository.loadProfiles())
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "profileIds".'
        });
    });

    it('should reject if profileIds is not an array of strings', () => {
      return should(profileRepository.loadProfiles(['a string', {foo: 'bar'}]))
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "profileIds" (expected: string[])'
        });
    });

    it('should resolve to an empty array if the input is empty', () => {
      profileRepository.loadOneFromDatabase = sinon.spy();

      return profileRepository.loadProfiles([])
        .then(result => {
          should(result).eql([]);
          should(profileRepository.loadOneFromDatabase)
            .have.callCount(0);
        });
    });

    it('should load & cache profiles', () => {
      const
        p1 = {_id: 'p1', foo: 'bar', constructor: {_hash: () => false}},
        p2 = {_id: 'p2', bar: 'baz', constructor: {_hash: () => false}},
        p3 = {_id: 'p3', baz: 'foo', constructor: {_hash: () => false}};

      profileRepository.load= sinon.stub();

      profileRepository.loadOneFromDatabase = sinon.stub();
      profileRepository.loadOneFromDatabase.withArgs('p1').resolves(p1);
      profileRepository.loadOneFromDatabase.withArgs('p3').resolves(p3);

      kuzzle.repositories.role.loadRoles.resolves([{_id: 'default'}]);

      profileRepository.profiles.set('p2', p2);

      return profileRepository.loadProfiles(['p1', 'p2', 'p3'])
        .then(result => {
          should(result).eql([p1, p2, p3]);
          // should not load p2 from the database since it has been cached
          should(profileRepository.loadOneFromDatabase).calledWith('p1');
          should(profileRepository.loadOneFromDatabase).neverCalledWith('p2');
          should(profileRepository.loadOneFromDatabase).calledWith('p3');
          should(profileRepository.profiles).have.value('p1', p1);
          should(profileRepository.profiles).have.value('p2', p2);
          should(profileRepository.profiles).have.value('p3', p3);
        });
    });

    it('should use only the cache if all profiles are known', () => {
      const
        p1 = {_id: 'p1', foo: 'bar', constructor: {_hash: () => false}},
        p2 = {_id: 'p2', bar: 'baz', constructor: {_hash: () => false}},
        p3 = {_id: 'p3', baz: 'foo', constructor: {_hash: () => false}};

      profileRepository.load= sinon.stub();

      profileRepository.loadMultiFromDatabase = sinon.stub();
      kuzzle.repositories.role.loadRoles.resolves([{_id: 'default'}]);

      profileRepository.profiles.set('p1', p1);
      profileRepository.profiles.set('p2', p2);
      profileRepository.profiles.set('p3', p3);

      return profileRepository.loadProfiles(['p1', 'p2', 'p3'])
        .then(result => {
          should(result).eql([p1, p2, p3]);
          // should not load p2 from the database since it has been cached
          should(profileRepository.loadMultiFromDatabase).not.called();
          should(profileRepository.profiles).have.value('p1', p1);
          should(profileRepository.profiles).have.value('p2', p2);
          should(profileRepository.profiles).have.value('p3', p3);
        });
    });
  });

  describe('#getProfileFromRequest', () => {
    it('should resolve to a valid Profile when a valid object is provided', () => {
      const
        profile = {
          foo: 'bar'
        },
        request = new Request({
          _id: 'foo',
          body: profile
        });

      kuzzle.repositories.role.loadRoles.resolves([{_id: 'default'}]);

      return profileRepository.getProfileFromRequest(request)
        .then(p => should(p).match(profile));
    });
  });

  describe('#initialize', () => {
    it('should throw if the profile contains unexisting roles', () => {
      kuzzle.repositories.role.loadRoles.resolves([null]);

      return should(profileRepository.fromDTO({
        policies: [
          {roleId: 'notExistingRole'}
        ]
      }))
        .be.rejectedWith(InternalError, { id: 'security.profile.cannot_hydrate' });
    });

    it('should set role default when none is given', () => {
      kuzzle.repositories.role.loadRoles.resolves([{_id: 'default'}]);

      return profileRepository.fromDTO({})
        .then(p => {
          should(p.policies).match([
            {roleId: 'default'}
          ]);
        });
    });
  });

  describe('#delete', () => {
    it('should reject and not trigger any event when no id is provided', done => {
      const invalidProfileObject = new Request({
        body: {
          _id: ''
        }
      });

      profileRepository.delete(invalidProfileObject)
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError);
          should(kuzzle.emit).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should reject and not trigger any event if a user uses the profile about to be deleted', done => {
      kuzzle.repositories.user.search.resolves({
        total: 1
      });

      profileRepository.delete({_id: 'test'})
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(PreconditionError, {
            id: 'security.profile.in_use'
          });
          should(kuzzle.emit).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should reject and not trigger any event when trying to delete admin', done => {
      const profile = {
        _id: 'admin',
        policies: [ {roleId: 'admin'} ]
      };

      profileRepository.delete(profile)
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError);
          should(kuzzle.emit).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should reject and not trigger any event when trying to delete default', done => {
      const profile = {
        _id: 'default',
        policies: [ {roleId: 'default'} ]
      };

      profileRepository.delete(profile)
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError);
          should(kuzzle.emit).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should reject and not trigger any event when trying to delete anonymous', done => {
      const profile = {
        _id: 'anonymous',
        policies: [ {roleId: 'anonymous'} ]
      };

      profileRepository.delete(profile)
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError);
          should(kuzzle.emit).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should return a raw delete response after deleting', () => {
      const response = {_id: 'testprofile'};

      kuzzle.repositories.user.search.resolves({});
      profileRepository.deleteFromCache = sinon.stub().resolves();
      profileRepository.deleteFromDatabase = sinon.stub().resolves(response);

      return profileRepository.delete(testProfile)
        .then(r => {
          should(r)
            .be.exactly(response);
        });
    });

    it('should call deleteFromDatabase, remove the profile from memory and trigger a "core:profileRepository:delete" event', () => {
      kuzzle.repositories.user.search.resolves({});
      profileRepository.deleteFromCache = sinon.stub().resolves();
      profileRepository.deleteFromDatabase = sinon.stub().resolves({acknowledge: true});
      profileRepository.profiles.set('foo', true);

      return profileRepository.delete({_id: 'foo'})
        .then(() => {
          should(profileRepository.deleteFromDatabase)
            .be.calledOnce()
            .be.calledWith('foo');
          should(profileRepository.profiles).not.have.key('foo');
          should(kuzzle.emit)
            .be.calledOnce()
            .be.calledWith('core:profileRepository:delete', {_id: 'foo'});
        });
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      const profile = testProfile;

      let result = profileRepository.serializeToDatabase(profile);

      should(result).not.be.an.instanceOf(Profile);
      should(result).be.an.Object();
      should(result).not.have.property('_id');
      should(result.policies).be.an.Array();
      should(result.policies).have.length(2);
      should(result.policies[0]).be.an.Object();
      should(result.policies[0]).not.be.an.instanceOf(Role);
      should(result.policies[0].roleId).be.exactly('test');
      should(result.policies[0].restrictedTo).be.an.Array();
      should(result.policies[1]).be.an.Object();
      should(result.policies[1]).not.be.an.instanceOf(Role);
      should(result.policies[1].roleId).be.exactly('test2');
      should(result.policies[1]).not.have.property('restrictedTo');
    });
  });

  describe('#searchProfiles', () => {
    it('should call search', () => {
      const opts = {from: 13, size: 42, scroll: 'foo'};
      profileRepository.search = sinon.spy();

      profileRepository.searchProfiles(false, opts);
      should(profileRepository.search)
        .be.calledOnce()
        .be.calledWith({query: {match_all: {}}}, opts);

      profileRepository.searchProfiles(['role1', 'role2']);
      should(profileRepository.search)
        .be.calledTwice()
        .be.calledWith({
          query: {
            terms: {'policies.roleId': ['role1', 'role2']}
          }
        });
    });
  });

  describe('#validateAndSaveProfile', () => {
    it('should reject and not trigger any event when no id is provided', done => {
      const invalidProfile = new Profile();
      invalidProfile._id = '';

      profileRepository.validateAndSaveProfile(invalidProfile)
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError).and.match({
            id: 'api.assert.missing_argument',
            message: 'Missing argument "profileId".'
          });
          should(kuzzle.emit).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should throw a NotFoundError when trying to write unexisting role in profile. ', () => {
      const invalidProfile = new Profile();
      invalidProfile._id = 'awesomeProfile';
      invalidProfile.policies = [{roleId: 'notSoAwesomeRole'}];

      kuzzle.repositories.role.loadRoles = sinon.stub().rejects();

      return should(profileRepository.validateAndSaveProfile(invalidProfile))
        .be.rejectedWith(InternalError, {
          id: 'security.profile.cannot_hydrate'
        });
    });

    it('should properly persist the profile and trigger a "core:profileRepository:save" event when ok', () => {
      profileRepository.persistToDatabase = sinon.stub().resolves(null);
      profileRepository.loadOneFromDatabase = sinon.stub().resolves(testProfile);

      return profileRepository.validateAndSaveProfile(testProfile)
        .then((result) => {
          should(result)
            .be.exactly(testProfile);
          should(profileRepository.profiles).have.value('foo', testProfile);
          should(kuzzle.emit)
            .be.calledOnce()
            .be.calledWith('core:profileRepository:save', {_id: testProfile._id, policies: testProfile.policies});
        });
    });

    it('should reject if we try to remove the anonymous role from the anonymous profile', () => {
      const profile = new Profile();
      profile._id = 'anonymous';
      profile.policies = [
        {roleId: 'test'},
        {roleId: 'another'}
      ];

      return should(profileRepository.validateAndSaveProfile(profile))
        .be.rejectedWith(BadRequestError, {
          id: 'security.profile.missing_anonymous_role'
        });
    });

    it('should accept to update the anonymous profile if the anonymous role is still in', () => {
      const profile = new Profile();
      profile._id = 'anonymous';
      profile.policies = [
        {roleId: 'test'},
        {roleId: 'anonymous'}
      ];
      profileRepository.loadOneFromDatabase = sinon.stub().resolves(profile);
      return profileRepository.validateAndSaveProfile(profile)
        .then(response => {
          should(response._id)
            .be.eql('anonymous');
        });
    });
  });

});
