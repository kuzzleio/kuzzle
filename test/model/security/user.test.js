'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  InternalError,
  Request,
} = require('../../../index');
const Kuzzle = require('../../mocks/kuzzle.mock');
const { Profile } = require('../../../lib/model/security/profile');
const { User } = require('../../../lib/model/security/user');


describe('Test: model/security/user', () => {
  let kuzzle;
  let profile;
  let profilePolicies;
  let profile2;
  let profilePolicies2;
  let user;

  beforeEach(() => {
    kuzzle = new Kuzzle();

    profile = new Profile();
    profile._id = 'profile';
    profile.isActionAllowed = sinon.stub().resolves(true);
    profilePolicies = [
      { 
        role: { checkRestrictions: sinon.stub().returns(false) },
        restrictedTo: new Map()
      },
      {
        role: { checkRestrictions: sinon.stub().returns(false) },
        restrictedTo: new Map()
      },
    ];
    profile.getAllowedPolicies = sinon.stub().resolves(profilePolicies);

    profile2 = new Profile();
    profile2._id = 'profile2';
    profile2.isActionAllowed = sinon.stub().resolves(false);
    profilePolicies2 = [
      { 
        role: { checkRestrictions: sinon.stub().returns(false) },
        restrictedTo: new Map()
      },
      { 
        role: { checkRestrictions: sinon.stub().returns(true) },
        restrictedTo: new Map()
      },
    ];
    profile2.getAllowedPolicies = sinon.stub().resolves(profilePolicies2);

    user = new User();
    user.profileIds = ['profile', 'profile2'];

    kuzzle.ask
      .withArgs('core:security:profile:mGet')
      .resolves([profile, profile2]);
  });

  it('should retrieve the good rights list', () => {
    const
      profileRights = {
        rights1: {
          controller: 'document',
          action: 'get',
          index: 'foo',
          collection: 'bar',
          value: 'allowed'
        },
        rights4: {
          controller: 'document',
          action: 'delete',
          index: 'foo',
          collection: 'bar',
          value: 'denied'
        }
      },
      profileRights2 = {
        rights1: {
          controller: 'document',
          action: 'get',
          index: 'foo',
          collection: 'bar',
          value: 'denied'
        },
        rights3: {
          controller: 'document',
          action: 'create',
          index: 'foo',
          collection: 'bar',
          value: 'allowed'
        }
      };

    sinon.stub(user, 'getProfiles').resolves([profile, profile2]);
    sinon.stub(profile, 'getRights').resolves(profileRights);
    sinon.stub(profile2, 'getRights').resolves(profileRights2);

    return user.getRights()
      .then(rights => {
        let filteredItem;

        should(rights).be.an.Object();
        rights = Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []);
        should(rights).be.an.Array();

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === 'get');

        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === 'delete');

        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('denied');

        filteredItem = rights.filter(
          item => item.controller === 'document' && item.action === 'create');

        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('allowed');
      });
  });

  it('should retrieve the profile', () => {
    return user.getProfiles()
      .then(p => {
        should(p).be.an.Array();
        should(p[0]).be.an.Object();
        should(p[0]).be.exactly(profile);
      });
  });

  it('should use the isActionAllowed method from its profile', () => {
    return user.isActionAllowed(new Request({}))
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.true();
        should(profile.isActionAllowed).be.called();
      });
  });

  it('should respond false if the user have no profileIds', () => {
    user.profileIds = [];
    return user.isActionAllowed(new Request({}))
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.false();
        should(profile.isActionAllowed).not.be.called();
      });
  });

  it('should reject if loadProfiles throws an error', () => {
    global.kuzzle = null;

    return should(user.isActionAllowed(new Request({}))).be.rejectedWith(
      InternalError,
      { id: 'security.user.uninitialized' });
  });

  describe('#isActionAllowed', () => {
    it('should return false if there is no profileIds', async () => {
      user.profileIds = undefined;
      let isAllowed = await user.isActionAllowed(new Request({}));
      await should(isAllowed).be.false();

      user.profileIds = [];
      isAllowed = await user.isActionAllowed(new Request({}));
      await should(isAllowed).be.false();
    });

    it('should call isActionAllowed on each profile until one resolves to true, only if there is no targets in the request', async () => {
      const profiles = [
        { isActionAllowed: sinon.stub().resolves(false) },
        { isActionAllowed: sinon.stub().resolves(true) },
      ];
      const request = new Request({});
      user.getProfiles = sinon.stub().resolves(profiles);
      const allowed = await user.isActionAllowed(request);

      await should(profiles[0].isActionAllowed)
        .be.calledOnce().and.be.calledWith(request);

      await should(profiles[1].isActionAllowed)
        .be.calledOnce().and.be.calledWith(request);

      await should(allowed).be.true();
    });

    it('should call areTargetsAllowed if the request contains targets', async () => {
      const profiles = [
        { isActionAllowed: sinon.stub().resolves(false) },
        { isActionAllowed: sinon.stub().resolves(true) },
      ];
      const targets = [
        { index: 'index', collections: ['collection'] },
        { index: 'foo', collections: ['bar'] },
      ];
      user.getProfiles = sinon.stub().resolves(profiles);
      user.areTargetsAllowed = sinon.stub().resolves(true);
      const request = new Request({
        targets
      });

      const allowed = await user.isActionAllowed(request);
      await should(allowed).be.true();
      await should(user.areTargetsAllowed)
        .be.calledOnce().and.be.calledWith(request, profiles, targets);
    });
  });

  describe('#areTargetsAllowed', () => {
    it('should retrieve policies for each profiles', async () => {
      const request = new Request({});
      await user.areTargetsAllowed(
        request,
        [profile, profile2],
        []
      );
      await should(profile.getAllowedPolicies)
        .be.calledOnce()
        .and.be.calledWith(request);
      await should(profile2.getAllowedPolicies)
        .be.calledOnce()
        .and.be.calledWith(request);
    });

    it('should return false if one of the targets contains a wildcard', async () => {
      const request = new Request({});
      let allowed = await user.areTargetsAllowed(
        request,
        [profile, profile2],
        [{ index: '*', collections: ['foo'] }]
      );

      await should(allowed).be.false();

      allowed = await user.areTargetsAllowed(
        request,
        [profile, profile2],
        [{ index: 'foo', collections: ['*'] }]
      );

      await should(allowed).be.false();
    });

    it('should return true if there is no targets', async () => {
      const request = new Request({});
      let allowed = await user.areTargetsAllowed(
        request,
        [profile, profile2],
        []
      );

      await should(allowed).be.true();
    });

    it('should skip targets with missing index or collections', async () => {
      const request = new Request({});
      let allowed = await user.areTargetsAllowed(
        request,
        [profile, profile2],
        [{ collections: ['foo'] }]
      );

      await should(allowed).be.true();

      allowed = await user.areTargetsAllowed(
        request,
        [profile, profile2],
        [{ index: 'foo' }]
      );

      await should(allowed).be.true();
    });

    it('should check the restrictions for each role of each policies of each profiles', async () => {
      const request = new Request({});
      let allowed = await user.areTargetsAllowed(
        request,
        [profile, profile2],
        [
          { index: 'foo', collections: ['bar', 'baz'] },
          { index: 'alpha', collections: ['beta'] },
        ]
      );

      await should(allowed).be.true();

      await sinon.assert.calledWithMatch(
        profilePolicies[0].role.checkRestrictions.firstCall,
        'foo',
        'bar',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies[0].role.checkRestrictions.secondCall,
        'foo',
        'baz',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies[0].role.checkRestrictions.thirdCall,
        'alpha',
        'beta',
        new Map(),
      );

      await sinon.assert.calledWithMatch(
        profilePolicies[1].role.checkRestrictions.firstCall,
        'foo',
        'bar',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies[1].role.checkRestrictions.secondCall,
        'foo',
        'baz',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies[1].role.checkRestrictions.thirdCall,
        'alpha',
        'beta',
        new Map(),
      );

      await sinon.assert.calledWithMatch(
        profilePolicies2[0].role.checkRestrictions.firstCall,
        'foo',
        'bar',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies2[0].role.checkRestrictions.secondCall,
        'foo',
        'baz',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies2[0].role.checkRestrictions.thirdCall,
        'alpha',
        'beta',
        new Map(),
      );

      await sinon.assert.calledWithMatch(
        profilePolicies2[1].role.checkRestrictions.firstCall,
        'foo',
        'bar',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies2[1].role.checkRestrictions.secondCall,
        'foo',
        'baz',
        new Map(),
      );
      await sinon.assert.calledWithMatch(
        profilePolicies2[1].role.checkRestrictions.thirdCall,
        'alpha',
        'beta',
        new Map(),
      );
    });
  });
});
