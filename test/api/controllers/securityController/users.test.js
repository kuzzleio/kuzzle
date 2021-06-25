'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const SecurityController = require('../../../../lib/api/controllers/securityController');
const {
  Request,
  PreconditionError
} = require('../../../../index');
const User = require('../../../../lib/model/security/user');

describe('Test: security controller - users', () => {
  let kuzzle;
  let securityController;
  let request;

  async function itShouldCallTheRealControllerInstead(
    oldAction,
    newAction,
    { controller = 'user', result } = {}
  ) {
    it('should call the other controller action', async () => {
      const newActionStub = sinon.stub().resolves(result);
      const funnelGetControllerStub = sinon.stub().returns({ [newAction]: newActionStub });
      kuzzle.funnel.controllers.get = funnelGetControllerStub;

      securityController = new SecurityController();
      await securityController[oldAction](request);

      should(funnelGetControllerStub).calledWithMatch(controller);
      should(newActionStub).be.called();
    });
  }

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    request = new Request({ controller: 'security' }, { user: new User() });
  });

  describe('#createFirstAdmin', () => {
    const adminExistsEvent = 'core:security:user:admin:exist';
    const createOrReplaceRoleEvent = 'core:security:role:createOrReplace';
    const createOrReplaceProfileEvent = 'core:security:profile:createOrReplace';
    let createOrReplaceRoleStub;
    let createOrReplaceProfileStub;
    let adminExistsStub;
    let createStub;
    let createEvent = 'core:security:user:create';

    beforeEach(() => {
      securityController = new SecurityController();

      createStub = kuzzle.ask.withArgs(createEvent);

      request.input.args._id = 'test';
      request.context.user._id = '4';

      createOrReplaceRoleStub = kuzzle.ask.withArgs(createOrReplaceRoleEvent);

      createOrReplaceProfileStub = kuzzle.ask
        .withArgs(createOrReplaceProfileEvent);

      adminExistsStub = kuzzle.ask
        .withArgs(adminExistsEvent)
        .resolves(false);
    });

    it('should reject if an admin already exists', async () => {
      adminExistsStub.resolves(true);

      await should(securityController.createFirstAdmin(request))
        .be.rejectedWith(PreconditionError, {id: 'api.process.admin_exists'});

      should(createStub).not.called();
      should(createOrReplaceRoleStub).not.called();
      should(createOrReplaceProfileStub).not.called();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', async () => {
      request.input.body = { content: { foo: 'bar' } };

      await securityController.createFirstAdmin(request);

      should(createStub)
        .calledOnce()
        .calledWithMatch(createEvent, request, ['admin'], request.input.body.content);

      should(createOrReplaceRoleStub).not.called();
      should(createOrReplaceProfileStub).not.called();
    });

    it('should create the admin user and reset roles & profiles if asked to', async () => {
      request.input.args.reset = true;

      await securityController.createFirstAdmin(request);

      should(createStub)
        .calledOnce()
        .calledWithMatch(createEvent, request, ['admin'], {});

      const config = kuzzle.config.security.standard;

      for (const [key, content] of Object.entries(config.roles)) {
        should(createOrReplaceRoleStub).calledWithMatch(
          createOrReplaceRoleEvent,
          key,
          content,
          { refresh: 'wait_for', userId: request.context.user._id });
      }

      for (const [key, content] of Object.entries(config.profiles)) {
        should(createOrReplaceProfileStub).calledWithMatch(
          createOrReplaceProfileEvent,
          key,
          content,
          { refresh: 'wait_for', userId: request.context.user._id });
      }
    });
  });

  describe('#createUser', async () => {
    await itShouldCallTheRealControllerInstead('createUser', 'create');
  });

  describe('#createRestrictedUser', async () => {
    await itShouldCallTheRealControllerInstead(
      'createRestrictedUser', 'signin', { controller: 'auth' });
  });

  describe('#getUser', async () => {
    await itShouldCallTheRealControllerInstead('getUser', 'get');
  });

  describe('#mGetUsers', async () => {
    await itShouldCallTheRealControllerInstead('mGetUsers', 'mGet');
  });

  describe('#searchUsers', async () => {
    await itShouldCallTheRealControllerInstead('searchUsers', 'search');
  });

  describe('#scrollUsers', async () => {
    await itShouldCallTheRealControllerInstead('scrollUsers', 'scroll');
  });

  describe('#updateUser', async () => {
    await itShouldCallTheRealControllerInstead('updateUser', 'update');
  });

  describe('#replaceUser', async () => {
    await itShouldCallTheRealControllerInstead('replaceUser', 'replace');
  });

  describe('#deleteUser', async () => {
    await itShouldCallTheRealControllerInstead('deleteUser', 'delete');
  });

  describe('#mDeleteUsers', async () => {
    await itShouldCallTheRealControllerInstead('mDeleteUsers', 'mDelete');
  });

  describe('#getUserMapping', async () => {
    await itShouldCallTheRealControllerInstead(
      'getUserMapping', 'getMappings', { result: { mappings: {} }});
  });

  describe('#updateUserMapping', async () => {
    await itShouldCallTheRealControllerInstead('updateUserMapping', 'updateMappings');
  });

  describe('#getUserRights', async () => {
    await itShouldCallTheRealControllerInstead(
      'getUserRights', 'getRights', { result: { rights: [] }});
  });

  describe('#checkRights', async () => {
    await itShouldCallTheRealControllerInstead('checkRights', 'isAllowed');
  });

  describe('#getUserStrategies', async () => {
    await itShouldCallTheRealControllerInstead(
      'getUserStrategies', 'getStrategies', { result: { strategies: [] }});
  });

  describe('#revokeTokens', async () => {
    await itShouldCallTheRealControllerInstead('revokeTokens', 'revokeTokens');
  });
});
