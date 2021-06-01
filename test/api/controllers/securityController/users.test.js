'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const SecurityController = require('../../../../lib/api/controllers/securityController');
const { Request } = require('../../../../index');

describe('Test: security controller - users', () => {
  let kuzzle;
  let securityController;
  let request;

  async function itShouldCallTheRealUserControllerInstead(
    oldAction,
    newAction,
  ) {
    it('should call the new user controller action', async () => {
      const newActionStub = sinon.stub();
      const funnelGetControllerStub = sinon.stub().returns({ [newAction]: newActionStub });

      kuzzle.funnel.controllers.get = funnelGetControllerStub;

      await securityController[oldAction](request);

      should(funnelGetControllerStub).calledWithMatch('user');
      should(newActionStub).be.called();
    });
  }

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController();
    request = new Request({});
  });

  describe('#createUser', async () => {
    await itShouldCallTheRealUserControllerInstead('createUser', 'create');
  });

  describe('#createRestrictedUser', async () => {
    await itShouldCallTheRealUserControllerInstead('createRestrictedUser', 'createRestricted');
  });

  describe('#createFirstAdmin', async () => {
    await itShouldCallTheRealUserControllerInstead('createFirstAdmin', 'createFirstAdmin');
  });

  describe('#getUser', async () => {
    await itShouldCallTheRealUserControllerInstead('getUser', 'get');
  });

  describe('#mGetUsers', async () => {
    await itShouldCallTheRealUserControllerInstead('mGetUsers', 'mGet');
  });

  describe('#searchUsers', async () => {
    await itShouldCallTheRealUserControllerInstead('searchUsers', 'search');
  });

  describe('#scrollUsers', async () => {
    await itShouldCallTheRealUserControllerInstead('scrollUsers', 'scroll');
  });

  describe('#updateUser', async () => {
    await itShouldCallTheRealUserControllerInstead('updateUser', 'update');
  });

  describe('#replaceUser', async () => {
    await itShouldCallTheRealUserControllerInstead('replaceUser', 'replace');
  });

  describe('#deleteUser', async () => {
    await itShouldCallTheRealUserControllerInstead('deleteUser', 'delete');
  });

  describe('#mDeleteUsers', async () => {
    await itShouldCallTheRealUserControllerInstead('mDeleteUsers', 'mDelete');
  });

  describe('#getUserMapping', async () => {
    await itShouldCallTheRealUserControllerInstead('getUserMapping', 'mappings');
  });

  describe('#updateUserMapping', async () => {
    await itShouldCallTheRealUserControllerInstead('updateUserMapping', 'updateMappings');
  });

  describe('#getUserRights', async () => {
    await itShouldCallTheRealUserControllerInstead('getUserRights', 'rights');
  });

  describe('#checkRights', async () => {
    await itShouldCallTheRealUserControllerInstead('checkRights', 'checkRights');
  });

  describe('#getUserStrategies', async () => {
    await itShouldCallTheRealUserControllerInstead('getUserStrategies', 'strategies');
  });

  describe('#revokeTokens', async () => {
    await itShouldCallTheRealUserControllerInstead('revokeTokens', 'revokeTokens');
  });
});
