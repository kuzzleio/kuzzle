'use strict';

const sinon = require('sinon');
const should = require('should');
const {
  errors: {
    BadRequestError,
    PreconditionError,
    NotFoundError,
    InternalError
  }
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Role = require('../../../lib/model/security/role');
const Profile = require('../../../lib/model/security/profile');
const ProfileRepository = require('../../../lib/core/security/profileRepository');
const Repository = require('../../../lib/core/shared/repository');

const _kuzzle = Symbol.for('_kuzzle');

describe.only('Test: security/profileRepository', () => {
  let kuzzle;
  let profileRepository;
  let testProfile;
  let roleRepositoryMock;
  let userRepositoryMock;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    roleRepositoryMock = {
      loadRoles: sinon.stub(),
    };

    userRepositoryMock = {
      search: sinon.stub(),
    };

    profileRepository = new ProfileRepository(kuzzle, {
      role: roleRepositoryMock,
      user: userRepositoryMock,
    });

    testProfile = new Profile();
    testProfile[_kuzzle] = kuzzle;
    testProfile._id = 'foo';
    testProfile.policies = [
      {roleId: 'test', restrictedTo: [{index: 'index'}]},
      {roleId: 'test2'}
    ];

    return profileRepository.init({ indexStorage: kuzzle.internalIndex });
  });

  describe('#events', () => {
    beforeEach(() => {
      kuzzle.ask.restore();
      sinon.stub(profileRepository);
    });

    it('should register a "create" event', async () => {
      await kuzzle.ask('core:security:profile:create', 'foo', 'bar', 'baz');

      should(profileRepository.create).calledWith('foo', 'bar', 'baz');
    });

    it('should register a "createOrReplace" event', async () => {
      await kuzzle.ask(
        'core:security:profile:createOrReplace',
        'foo',
        'bar',
        'baz');

      should(profileRepository.createOrReplace).calledWith('foo', 'bar', 'baz');
    });

    it('should register a "delete" event', async () => {
      await kuzzle.ask('core:security:profile:delete', 'foo', 'bar');

      should(profileRepository.deleteById).calledWith('foo', 'bar');
    });

    it('should register a "get" event', async () => {
      await kuzzle.ask('core:security:profile:get', 'foo');

      should(profileRepository.load).calledWith('foo');
    });

    it('should register a "mGet" event', async () => {
      await kuzzle.ask('core:security:profile:mGet', 'foo');

      should(profileRepository.loadProfiles).calledWith('foo');
    });

    it('should register a "scroll" event', async () => {
      await kuzzle.ask('core:security:profile:scroll', 'foo', 'bar');

      should(profileRepository.scroll).calledWith('foo', 'bar');
    });

    it('should register a "search" event', async () => {
      await kuzzle.ask('core:security:profile:search', 'foo', 'bar');

      should(profileRepository.searchProfiles).calledWith('foo', 'bar');
    });

    it('should register a "truncate" event', async () => {
      await kuzzle.ask('core:security:profile:truncate', 'foo');

      should(profileRepository.truncate).calledWith('foo');
    });

    it('should register a "update" event', async () => {
      await kuzzle.ask('core:security:profile:update', 'foo', 'bar', 'baz');

      should(profileRepository.update).calledWith('foo', 'bar', 'baz');
    });
  });

  describe('#load', () => {
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

    it('should load a profile from the db', async () => {
      const p = {foo: 'bar', constructor: {_hash: () => false}};

      // ProfileRepository
      const proto = Object.getPrototypeOf(profileRepository);
      // Repository
      const parent = Object.getPrototypeOf(proto);

      sinon.stub(parent, 'load').resolves(p);

      roleRepositoryMock.loadRoles.resolves([{_id: 'default'}]);

      const profile = await profileRepository.load('foo');

      should(profile).be.exactly(p);
      should(profileRepository.profiles).have.value('foo', p);

      // important! for a reason I don't explain, invalidating require cache is not good enough
      parent.load.restore();
    });

  });

  describe('#loadProfiles', () => {
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

    it('should load & cache profiles', async () => {
      const p1 = {_id: 'p1', foo: 'bar', constructor: {_hash: () => false}};
      const p2 = {_id: 'p2', bar: 'baz', constructor: {_hash: () => false}};
      const p3 = {_id: 'p3', baz: 'foo', constructor: {_hash: () => false}};

      profileRepository.load = sinon.stub();

      profileRepository.loadOneFromDatabase = sinon.stub();
      profileRepository.loadOneFromDatabase.withArgs('p1').resolves(p1);
      profileRepository.loadOneFromDatabase.withArgs('p3').resolves(p3);

      roleRepositoryMock.loadRoles.resolves([{_id: 'default'}]);

      profileRepository.profiles.set('p2', p2);

      const result = await profileRepository.loadProfiles(['p1', 'p2', 'p3']);

      should(result).eql([p1, p2, p3]);
      // should not load p2 from the database since it has been cached
      should(profileRepository.loadOneFromDatabase).calledWith('p1');
      should(profileRepository.loadOneFromDatabase).neverCalledWith('p2');
      should(profileRepository.loadOneFromDatabase).calledWith('p3');
      should(profileRepository.profiles).have.value('p1', p1);
      should(profileRepository.profiles).have.value('p2', p2);
      should(profileRepository.profiles).have.value('p3', p3);
    });

    it('should use only the cache if all profiles are known', async () => {
      const p1 = {_id: 'p1', foo: 'bar', constructor: {_hash: () => false}};
      const p2 = {_id: 'p2', bar: 'baz', constructor: {_hash: () => false}};
      const p3 = {_id: 'p3', baz: 'foo', constructor: {_hash: () => false}};

      profileRepository.load= sinon.stub();

      profileRepository.loadMultiFromDatabase = sinon.stub();
      roleRepositoryMock.loadRoles.resolves([{_id: 'default'}]);

      profileRepository.profiles.set('p1', p1);
      profileRepository.profiles.set('p2', p2);
      profileRepository.profiles.set('p3', p3);

      const result = await profileRepository.loadProfiles(['p1', 'p2', 'p3']);

      should(result).eql([p1, p2, p3]);
      // should not load p2 from the database since it has been cached
      should(profileRepository.loadMultiFromDatabase).not.called();
      should(profileRepository.profiles).have.value('p1', p1);
      should(profileRepository.profiles).have.value('p2', p2);
      should(profileRepository.profiles).have.value('p3', p3);
    });
  });

  describe('#fromDTO', () => {
    it('should throw if the profile contains unexisting roles', () => {
      roleRepositoryMock.loadRoles.resolves([null]);

      return should(profileRepository.fromDTO({
        policies: [
          {roleId: 'notExistingRole'}
        ]
      }))
        .be.rejectedWith(InternalError, { id: 'security.profile.cannot_hydrate' });
    });

    it('should set role default when none is given', async () => {
      roleRepositoryMock.loadRoles.resolves([{_id: 'default'}]);

      const p = await profileRepository.fromDTO({});

      should(p.policies).match([
        {roleId: 'default'}
      ]);
    });
  });

  describe('#delete', () => {
    it('should reject and not trigger any event if a user uses the profile about to be deleted', async () => {
      userRepositoryMock.search.resolves({ total: 1 });

      await should(profileRepository.delete({_id: 'test'}))
        .be.rejectedWith(PreconditionError, { id: 'security.profile.in_use' });

      should(kuzzle.emit).not.be.called();
    });

    it('should reject and not trigger any event when trying to delete a reserved profile', async () => {
      const profile = new Profile();

      for (const id of ['anonymous', 'default', 'admin']) {
        profile._id = id;

        await should(profileRepository.delete(profile))
          .rejectedWith(BadRequestError, {
            id: 'security.profile.cannot_delete'
          });

        should(kuzzle.emit).not.be.called();
      }
    });

    it('should call deleteFromDatabase, remove the profile from memory and trigger a "core:profileRepository:delete" event', async () => {
      userRepositoryMock.search.resolves({});
      profileRepository.deleteFromCache = sinon.stub().resolves();
      profileRepository.deleteFromDatabase = sinon.stub().resolves({
        acknowledge: true
      });
      profileRepository.profiles.set('foo', true);

      await profileRepository.delete({_id: 'foo'});

      should(profileRepository.deleteFromDatabase)
        .be.calledOnce()
        .be.calledWith('foo');
      should(profileRepository.profiles).not.have.key('foo');
      should(kuzzle.emit)
        .be.calledOnce()
        .be.calledWith('core:profileRepository:delete', {_id: 'foo'});
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
    it('should throw if roles cannot be loaded', () => {
      const invalidProfile = new Profile();
      invalidProfile._id = 'awesomeProfile';
      invalidProfile.policies = [{roleId: 'notSoAwesomeRole'}];

      const error = new Error('foo');
      roleRepositoryMock.loadRoles
        .withArgs(['notSoAwesomeRole'])
        .rejects(error);

      return should(profileRepository.validateAndSaveProfile(invalidProfile))
        .be.rejectedWith(error);
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

  describe('#loadOneFromDatabase', () => {
    beforeEach(() => {
      sinon.stub(Repository.prototype, 'loadOneFromDatabase');
    });

    afterEach(() => {
      Repository.prototype.loadOneFromDatabase.restore();
    });

    it('should invoke its super function', async () => {
      Repository.prototype.loadOneFromDatabase.resolves('foo');

      await should(profileRepository.loadOneFromDatabase('bar'))
        .fulfilledWith('foo');

      should(Repository.prototype.loadOneFromDatabase)
        .calledWith('bar');
    });

    it('should wrap generic 404s into profile dedicated errors', () => {
      const error = new Error('foo');
      error.status = 404;

      Repository.prototype.loadOneFromDatabase.rejects(error);

      return should(profileRepository.loadOneFromDatabase('foo'))
        .rejectedWith(NotFoundError, { id: 'security.profile.not_found' });
    });

    it('should re-throw non-404 errors as is', () => {
      const error = new Error('foo');

      Repository.prototype.loadOneFromDatabase.rejects(error);

      return should(profileRepository.loadOneFromDatabase('foo'))
        .rejectedWith(error);
    });
  });

  describe('#create', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'validateAndSaveProfile');
      roleRepositoryMock.loadRoles.resolves([]);
    });

    it('should pass the right configuration to validateAndSaveProfile', async () => {
      const content = {
        _id: 'ohnoes',
        _kuzzle_info: 'nope',
        bar: 'bar',
        foo: 'foo',
      };

      await profileRepository.create('foobar', content, {
        refresh: 'refresh',
        userId: 'userId',
      });

      should(profileRepository.validateAndSaveProfile)
        .calledWithMatch(sinon.match.object, {
          method: 'create',
          refresh: 'refresh'
        });

      const profile = profileRepository.validateAndSaveProfile.firstCall.args[0];
      should(profile).instanceOf(Profile);
      should(profile._id).eql('foobar');
      should(profile.bar).eql('bar');
      should(profile.foo).eql('foo');
      should(profile._kuzzle_info).match({
        author: 'userId',
        updatedAt: null,
        updater: null,
      });
      should(profile._kuzzle_info.createdAt).approximately(Date.now(), 1000);
    });
  });

  describe('#createOrReplace', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'validateAndSaveProfile');
      roleRepositoryMock.loadRoles.resolves([]);
    });

    it('should pass the right configuration to validateAndSaveProfile', async () => {
      const content = {
        _id: 'ohnoes',
        _kuzzle_info: 'nope',
        bar: 'bar',
        foo: 'foo',
      };

      await profileRepository.createOrReplace('foobar', content, {
        refresh: 'refresh',
        userId: 'userId',
      });

      should(profileRepository.validateAndSaveProfile)
        .calledWithMatch(sinon.match.object, {
          method: 'createOrReplace',
          refresh: 'refresh'
        });

      const profile = profileRepository.validateAndSaveProfile.firstCall.args[0];
      should(profile).instanceOf(Profile);
      should(profile._id).eql('foobar');
      should(profile.bar).eql('bar');
      should(profile.foo).eql('foo');
      should(profile._kuzzle_info).match({
        author: 'userId',
        updatedAt: null,
        updater: null,
      });
      should(profile._kuzzle_info.createdAt).approximately(Date.now(), 1000);
    });
  });
});
