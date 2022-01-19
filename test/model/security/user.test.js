'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  InternalError,
  Request,
} = require('../../../index');
const Kuzzle = require('../../mocks/kuzzle.mock');
const Profile = require('../../../lib/model/security/profile').default;
const User = require('../../../lib/model/security/user').default;


describe('Test: model/security/user', () => {
  let kuzzle;
  let profile;
  let profile2;
  let user;

  beforeEach(() => {
    kuzzle = new Kuzzle();

    profile = new Profile();
    profile._id = 'profile';
    profile.isActionAllowed = sinon.stub().resolves(true);

    profile2 = new Profile();
    profile2._id = 'profile2';
    profile2.isActionAllowed = sinon.stub().resolves(false);

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

});
