'use strict';

const sinon = require('sinon');
const should = require('should');

const {
  BadRequestError,
  PreconditionError,
  NotFoundError,
  InternalError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const { Role } = require('../../../lib/model/security/role');
const { Profile } = require('../../../lib/model/security/profile');
const { ProfileRepository } = require('../../../lib/core/security/profileRepository');
const Repository = require('../../../lib/core/shared/repository');

describe('Test: security/profileRepository', () => {
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
      update: sinon.stub(),
    };

    profileRepository = new ProfileRepository({
      role: roleRepositoryMock,
      user: userRepositoryMock,
    });

    testProfile = new Profile();
    testProfile._id = 'foo';
    testProfile.policies = [
      { roleId: 'test', restrictedTo: [{ index: 'index' }] },
      { roleId: 'test2' }
    ];

    return profileRepository.init();
  });

  describe('#get', () => {
    it('should register a "get" event', async () => {
      sinon.stub(profileRepository, 'load');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:get', 'foo');

      should(profileRepository.load).calledWith('foo');
    });

    it('should return a profile from memory cache', async () => {
      profileRepository.profiles.set('foo', testProfile);

      const profile = await profileRepository.load('foo');

      should(profile).be.exactly(testProfile);
    });

    it('should reject if the profile does not exist', () => {
      kuzzle.ask
        .withArgs(
          'core:storage:private:document:get',
          kuzzle.internalIndex.index,
          'profiles',
          'idontexist')
        .rejects(new NotFoundError('Not found'));

      return should(profileRepository.load('idontexist'))
        .rejectedWith(NotFoundError, { id: 'security.profile.not_found' });
    });

    it('should load a profile from the db', async () => {
      roleRepositoryMock.loadRoles.resolves([{ _id: 'default' }]);

      let profile;

      try {
        sinon.stub(Repository.prototype, 'load').resolves(testProfile);
        profile = await profileRepository.load('foo');
      }
      finally {
        Repository.prototype.load.restore();
      }

      should(profile).be.exactly(testProfile);
      should(profileRepository.profiles).have.value('foo', testProfile);
    });
  });

  describe('#mGet', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'loadOneFromDatabase');
    });

    it('should register a "mGet" event', async () => {
      sinon.stub(profileRepository, 'loadProfiles');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:mGet', 'foo');

      should(profileRepository.loadProfiles).calledWith('foo');
    });

    it('should reject if profileIds is not an array of strings', () => {
      return should(profileRepository.loadProfiles(['a string', { foo: 'bar' }]))
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "profileIds" (expected: string[])'
        });
    });

    it('should resolve to an empty array if the input is empty', async () => {
      const result = await profileRepository.loadProfiles([]);

      should(result).eql([]);
      should(profileRepository.loadOneFromDatabase).not.called();
    });

    it('should load & cache profiles', async () => {
      const p1 = { _id: 'p1', foo: 'bar', constructor: { _hash: () => false } };
      const p2 = { _id: 'p2', bar: 'baz', constructor: { _hash: () => false } };
      const p3 = { _id: 'p3', baz: 'foo', constructor: { _hash: () => false } };

      profileRepository.loadOneFromDatabase.withArgs('p1').resolves(p1);
      profileRepository.loadOneFromDatabase.withArgs('p3').resolves(p3);

      roleRepositoryMock.loadRoles.resolves([{ _id: 'default' }]);

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
      const p1 = { _id: 'p1', foo: 'bar', constructor: { _hash: () => false } };
      const p2 = { _id: 'p2', bar: 'baz', constructor: { _hash: () => false } };
      const p3 = { _id: 'p3', baz: 'foo', constructor: { _hash: () => false } };

      roleRepositoryMock.loadRoles.resolves([{ _id: 'default' }]);

      profileRepository.profiles.set('p1', p1);
      profileRepository.profiles.set('p2', p2);
      profileRepository.profiles.set('p3', p3);

      const result = await profileRepository.loadProfiles(['p1', 'p2', 'p3']);

      should(result).eql([p1, p2, p3]);
      // should not load p2 from the database since it has been cached
      should(profileRepository.loadOneFromDatabase).not.called();
      should(profileRepository.profiles).have.value('p1', p1);
      should(profileRepository.profiles).have.value('p2', p2);
      should(profileRepository.profiles).have.value('p3', p3);
    });
  });


  describe('#fromDTO', () => {
    it('should throw if the profile contains unexisting roles', () => {
      roleRepositoryMock.loadRoles.resolves([null]);

      const dto = {
        policies: [
          { roleId: 'notExistingRole' }
        ]
      };

      return should(profileRepository.fromDTO(dto))
        .be.rejectedWith(InternalError, {
          id: 'security.profile.cannot_hydrate'
        });
    });

    it('should set role default when none is given', async () => {
      roleRepositoryMock.loadRoles.resolves([{ _id: 'default' }]);

      const p = await profileRepository.fromDTO({});

      should(p.policies).match([
        { roleId: 'default' }
      ]);
    });
  });

  describe('#delete', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'load').resolves(testProfile);
      sinon.stub(profileRepository, 'deleteFromCache').resolves();
      sinon.stub(profileRepository, 'deleteFromDatabase').resolves({
        acknowledge: true
      });
      userRepositoryMock.search.resolves({});
    });

    it('should register a "delete" event', async () => {
      sinon.stub(profileRepository, 'deleteById');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:delete', 'foo', 'bar');

      should(profileRepository.deleteById).calledWith('foo', 'bar');
    });

    it('should reject and not trigger any event if a user uses the profile about to be deleted', async () => {
      userRepositoryMock.search.resolves({ total: 1 });

      await should(profileRepository.deleteById(testProfile._id))
        .be.rejectedWith(PreconditionError, { id: 'security.profile.in_use' });

      should(userRepositoryMock.search).calledWithMatch(
        { query: { terms: { profileIds: [ testProfile._id ] } } },
        { from: 0, size: 1 });

      should(kuzzle.emit).not.be.called();
      should(profileRepository.deleteFromDatabase).not.called();
      should(profileRepository.deleteFromCache).not.called();
    });

    it('should reject when trying to delete a reserved profile', async () => {
      for (const id of ['anonymous', 'default', 'admin']) {
        testProfile._id = id;

        await should(profileRepository.deleteById(id))
          .rejectedWith(BadRequestError, {
            id: 'security.profile.cannot_delete'
          });

        should(userRepositoryMock.search).not.called();
        should(kuzzle.emit).not.be.called();
        should(profileRepository.deleteFromDatabase).not.called();
        should(profileRepository.deleteFromCache).not.called();
      }
    });

    it('should call deleteFromDatabase and remove the profile from memory', async () => {
      profileRepository.profiles.set(testProfile._id, true);

      await profileRepository.deleteById(testProfile._id);

      should(profileRepository.deleteFromDatabase)
        .be.calledOnce()
        .be.calledWithMatch(testProfile._id, { refresh: 'false' });

      should(profileRepository.profiles).not.have.key(testProfile._id);
    });

    it('should be able to handle the refresh option', async () => {
      await profileRepository.deleteById(testProfile._id, {
        refresh: 'wait_for',
      });

      should(profileRepository.deleteFromDatabase)
        .be.calledOnce()
        .be.calledWithMatch(testProfile._id, { refresh: 'wait_for' });
    });

    it('should be able to remove the profile from users when required', async () => {
      const user = {
        _id: 'baz',
        foo: 'bar',
        profileIds: [ testProfile._id ],
      };

      userRepositoryMock.search.resolves({
        hits: [ user ],
        total: 1,
      });

      profileRepository.profiles.set(testProfile._id, true);

      await profileRepository.deleteById(testProfile._id, {
        onAssignedUsers: 'remove',
      });

      should(userRepositoryMock.search).be.called();

      should(userRepositoryMock.update)
        .be.calledOnce()
        .be.calledWithMatch(user._id, ['anonymous'], user);

      should(profileRepository.deleteFromDatabase)
        .be.calledOnce()
        .be.calledWithMatch(testProfile._id, { refresh: 'false' });

      should(profileRepository.profiles).not.have.key(testProfile._id);
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

  describe('#search', () => {
    it('should register a "search" event', async () => {
      sinon.stub(profileRepository, 'search');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:search', 'foo', 'bar');

      should(profileRepository.search).calledWith('foo', 'bar');
    });
  });

  describe('#validateAndSaveProfile', () => {
    beforeEach(() => {
      kuzzle.ask.withArgs('core:storage:index:isValid').resolves(true);
    });

    it('should throw if roles cannot be loaded', () => {
      const invalidProfile = new Profile();
      invalidProfile._id = 'awesomeProfile';
      invalidProfile.policies = [{ roleId: 'notSoAwesomeRole' }];

      const error = new Error('foo');
      roleRepositoryMock.loadRoles
        .withArgs(['notSoAwesomeRole'])
        .rejects(error);

      return should(profileRepository.validateAndSaveProfile(invalidProfile))
        .be.rejectedWith(error);
    });

    it('should properly persist the profile', async () => {
      profileRepository.persistToDatabase = sinon.stub().resolves(null);
      profileRepository.loadOneFromDatabase = sinon.stub().resolves(testProfile);
      kuzzle.ask.withArgs('core:storage:public:index:exist').resolves(true);
      kuzzle.ask.withArgs('core:storage:public:collection:exist').resolves(true);

      const result = await profileRepository.validateAndSaveProfile(testProfile);

      should(result).be.exactly(testProfile);
      should(profileRepository.profiles).have.value('foo', testProfile);
    });

    it('should compute the optimized policies', async () => {
      profileRepository.loadOneFromDatabase = sinon.stub().resolves(testProfile);
      profileRepository.persistToDatabase = sinon.stub().resolves(null);
      profileRepository.optimizePolicies = sinon.stub().resolves([]);
      kuzzle.ask.withArgs('core:storage:public:index:exist').resolves(true);
      kuzzle.ask.withArgs('core:storage:public:collection:exist').resolves(true);

      await profileRepository.validateAndSaveProfile(testProfile);

      should(profileRepository.optimizePolicies).be.calledOnce();
    });

    it('should reject if we try to remove the anonymous role from the anonymous profile', () => {
      const profile = new Profile();
      profile._id = 'anonymous';
      profile.policies = [
        { roleId: 'test' },
        { roleId: 'another' }
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
        { roleId: 'test' },
        { roleId: 'anonymous' }
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

  describe('#load', () => {
    afterEach(() => {
      Repository.prototype.load.restore();
    });


    it('should compute the optimized policies', async () => {
      sinon.stub(Repository.prototype, 'load').resolves(testProfile);

      profileRepository.optimizePolicies = sinon.stub().resolves([]);

      await profileRepository.load('foobar');

      should(profileRepository.optimizePolicies).be.calledOnce();
    });
  });

  describe('#create', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'validateAndSaveProfile');
      roleRepositoryMock.loadRoles.resolves([]);
    });

    it('should register a "create" event', async () => {
      sinon.stub(profileRepository, 'create');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:create', 'foo', 'bar', 'baz');

      should(profileRepository.create).calledWith('foo', 'bar', 'baz');
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

    it('should resolve to the validateAndSaveProfile result', () => {
      profileRepository.validateAndSaveProfile.resolves('foobar');

      return should(profileRepository.create('foo', {}, {}))
        .fulfilledWith('foobar');
    });
  });

  describe('#createOrReplace', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'validateAndSaveProfile');
      roleRepositoryMock.loadRoles.resolves([]);
    });

    it('should register a "createOrReplace" event', async () => {
      sinon.stub(profileRepository, 'createOrReplace');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:createOrReplace', 'foo', 'bar', 'baz');

      should(profileRepository.createOrReplace).calledWith('foo', 'bar', 'baz');
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

    it('should resolve to the validateAndSaveProfile result', () => {
      profileRepository.validateAndSaveProfile.resolves('foobar');

      return should(profileRepository.createOrReplace('foo', {}, {}))
        .fulfilledWith('foobar');
    });
  });

  describe('#update', () => {
    beforeEach(() => {
      sinon.stub(profileRepository, 'validateAndSaveProfile');
      sinon.stub(profileRepository, 'load').resolves(new Profile());
      roleRepositoryMock.loadRoles.resolves([]);
    });

    it('should register a "update" event', async () => {
      sinon.stub(profileRepository, 'update');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:update', 'foo', 'bar', 'baz');

      should(profileRepository.update).calledWith('foo', 'bar', 'baz');
    });

    it('should reject if the profile does not exist', () => {
      const error = new Error('foo');
      profileRepository.load.rejects(new Error('foo'));

      return should(profileRepository.update('foo', {}, {}))
        .rejectedWith(error);
    });

    it('should pass the right configuration to validateAndSaveProfile', async () => {
      const content = {
        _id: 'ohnoes',
        _kuzzle_info: 'nope',
        bar: 'bar',
        foo: 'foo',
      };

      await profileRepository.update('foobar', content, {
        refresh: 'refresh',
        userId: 'userId',
      });

      should(profileRepository.validateAndSaveProfile)
        .calledWithMatch(sinon.match.object, {
          method: 'update',
          refresh: 'refresh'
        });

      const profile = profileRepository.validateAndSaveProfile.firstCall.args[0];
      should(profile).instanceOf(Profile);
      should(profile._id).eql('foobar');
      should(profile.bar).eql('bar');
      should(profile.foo).eql('foo');
      should(profile._kuzzle_info).match({
        updater: 'userId',
      });
      should(profile._kuzzle_info.updatedAt).approximately(Date.now(), 1000);
    });

    it('should resolve to the validateAndSaveProfile result', () => {
      profileRepository.validateAndSaveProfile.resolves('foobar');

      return should(profileRepository.update('foo', {}, {}))
        .fulfilledWith('foobar');
    });
  });

  describe('#scroll', () => {
    it('should register a "scroll" event', async () => {
      sinon.stub(profileRepository, 'scroll');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:scroll', 'foo', 'bar');

      should(profileRepository.scroll).calledWith('foo', 'bar');
    });
  });

  describe('#truncate', () => {
    beforeEach(() => {
      sinon.stub(Repository.prototype, 'truncate').resolves();
    });

    afterEach(() => {
      Repository.prototype.truncate.restore();
    });

    it('should register a "truncate" event', async () => {
      sinon.stub(profileRepository, 'truncate');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:truncate', 'foo');

      should(profileRepository.truncate).calledWith('foo');
    });

    it('should clear the RAM cache once the truncate succeeds', async () => {
      const opts = { foo: 'bar' };

      profileRepository.profiles.set('foo', 'bar');
      profileRepository.profiles.set('baz', 'qux');

      await profileRepository.truncate(opts);

      should(Repository.prototype.truncate).calledWith(opts);
      should(profileRepository.profiles).be.empty();
    });

    it('should clear the RAM cache even if the truncate fails', async () => {
      const error = new Error('foo');

      Repository.prototype.truncate.rejects(error);

      profileRepository.profiles.set('foo', 'bar');
      profileRepository.profiles.set('baz', 'qux');

      await should(profileRepository.truncate()).rejectedWith(error);

      should(profileRepository.profiles).be.empty();
    });
  });

  describe('#optimizePolicy', () => {
    it('should merge restriction with same indices', () => {
      const policy = profileRepository.optimizePolicy({
        roleId: 'foo',
        restrictedTo: [
          {
            index: 'foo',
            collections: ['bar']
          },
          {
            index: 'foo',
            collections: ['baz']
          }
        ]
      });

      should(policy).match({
        roleId: 'foo',
        restrictedTo: new Map(Object.entries({
          'foo': ['bar', 'baz']
        }))
      });
    });

    it('should remove duplicated collections and sort the collections', () => {
      const policy = profileRepository.optimizePolicy({
        roleId: 'foo',
        restrictedTo: [
          {
            index: 'foo',
            collections: ['qux', 'bar']
          },
          {
            index: 'foo',
            collections: ['baz', 'bar']
          }
        ]
      });

      should(policy).match({
        roleId: 'foo',
        restrictedTo: new Map(Object.entries({
          'foo': ['bar', 'baz', 'qux']
        }))
      });
    });
  });

  describe('#invalidate', () => {
    it('should register an "invalidate" event', async () => {
      sinon.stub(profileRepository, 'invalidate');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:profile:invalidate', 'foo');

      should(profileRepository.invalidate).calledWith('foo');
    });

    it('should invalidate only the provided profile', async () => {
      profileRepository.profiles.set('foo', 'bar');
      profileRepository.profiles.set('baz', 'qux');

      await profileRepository.invalidate('baz');

      should(profileRepository.profiles).has.key('foo');
      should(profileRepository.profiles).not.has.key('baz');
    });

    it('should invalidate the entire cache with no argument', async () => {
      profileRepository.profiles.set('foo', 'bar');
      profileRepository.profiles.set('baz', 'qux');

      await profileRepository.invalidate();

      should(profileRepository.profiles).be.empty();
    });
  });
});
