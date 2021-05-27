'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  BadRequestError,
  PluginImplementationError,
  SizeLimitError,
  PreconditionError
} = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const SecurityController = require('../../../../lib/api/controllers/securityController');
const User = require('../../../../lib/model/security/user');

describe('Test: security controller - users', () => {
  let kuzzle;
  let request;
  let securityController;

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
    securityController.anonymousId = '-1';
    request = new Request(
      {controller: 'security'},
      {user: new User()});

    // Random number chosen by fair dice roll. Guaranteed to be random.
    // (xkcd #221)
    request.context.user._id = '4';
  });

  describe('#checkRights', async () => {
    await itShouldCallTheRealUserControllerInstead('checkRights', 'checkRights');
  });

  // aka "The Big One"
  describe('#persistUser', () => {
    const createEvent = 'core:security:user:create';
    const deleteEvent = 'core:security:user:delete';
    const content = { foo: 'bar' };
    let fakeUser;
    let profileIds;
    let createStub;
    let deleteStub;
    let strategyCreateStub;
    let strategyExistsStub;
    let strategyValidateStub;

    beforeEach(() => {
      profileIds = ['foo' ];
      request.input.args._id = 'test';
      request.input.body = {
        content: {name: 'John Doe', profileIds},
        credentials: {someStrategy: {some: 'credentials'}}
      };
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      fakeUser = new User();
      createStub = kuzzle.ask
        .withArgs(createEvent, request.input.args._id, profileIds, content)
        .resolves(fakeUser);
      deleteStub = kuzzle.ask
        .withArgs(deleteEvent, request.input.args._id, sinon.match.object)
        .resolves();

      strategyCreateStub = sinon.stub().resolves();
      strategyExistsStub = sinon.stub().resolves(false);
      strategyValidateStub = sinon.stub().resolves();

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'create')
        .returns(strategyCreateStub);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'exists')
        .returns(strategyExistsStub);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'validate')
        .returns(strategyValidateStub);
    });

    it('should reject if a strategy is unknown', async () => {
      kuzzle.pluginsManager.listStrategies.returns(['oops']);

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(BadRequestError, {
          id: 'security.credentials.unknown_strategy'
        });

      should(createStub).not.called();
      should(deleteStub).not.called();
    });

    it('should reject if credentials already exist on the provided user id', async () => {
      strategyExistsStub.resolves(true);

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(PluginImplementationError, {
          id: 'security.credentials.database_inconsistency'
        });

      should(createStub).not.called();
      should(deleteStub).not.called();
    });

    it('should rollback if credentials don\'t validate the strategy', async () => {
      strategyValidateStub.rejects(new Error('error'));

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(BadRequestError, {
          id: 'security.credentials.rejected'
        });

      should(kuzzle.ask).calledWithMatch(
        createEvent,
        request.input.args._id,
        profileIds,
        content,
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWithMatch(
        deleteEvent,
        request.input.args._id,
        { refresh: 'false' });
    });

    it('should reject and rollback if credentials don\'t create properly', async () => {
      strategyCreateStub.rejects(new Error('some error'));

      await should(securityController._persistUser(request, profileIds, content))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.runtime.unexpected_error',
        });

      should(kuzzle.ask).calledWithMatch(
        deleteEvent,
        request.input.args._id,
        { refresh: 'false' });
    });

    it('should not create credentials if user creation fails', async () => {
      const error = new Error('error');
      createStub.rejects(error);

      await should(securityController._persistUser(request, profileIds, content))
        .rejectedWith(error);

      should(strategyCreateStub).not.called();
    });

    it('should intercept errors during deletion of a rollback phase', async () => {
      kuzzle.pluginsManager.listStrategies.returns(['foo', 'someStrategy']);

      // "foo" should be called after before "someStrategy": we make the stub
      // fail when the "create" method is invoked, and we make the
      // "delete" method of someStrategy fail too
      const strategyDeleteStub = sinon.stub()
        .rejects(new Error('someStrategy delete error'));

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'validate')
        .returns(sinon.stub().resolves());
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'exists')
        .returns(sinon.stub().resolves(false));
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'create')
        .returns(sinon.stub().rejects(new Error('oh noes')));
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'delete')
        .returns(strategyDeleteStub);

      request.input.body.credentials.foo = { firstname: 'X Æ A-12' };

      await should(securityController._persistUser(request, profileIds, content))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.runtime.unexpected_error',
          message: /.*oh noes\nsomeStrategy delete error\n.*/,
        });

      should(strategyDeleteStub).calledWithMatch(
        request,
        request.input.args._id,
        'someStrategy');
    });

    it('should return the plugin error if it threw a KuzzleError error', async () => {
      const error = new BadRequestError('foo');

      strategyValidateStub.rejects(error);

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(error);

      strategyValidateStub.resolves();
      strategyCreateStub.rejects(error);

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(error);
    });
  });

  describe('#updateUserMapping', async () => {
    await itShouldCallTheRealUserControllerInstead('updateUserMapping', 'updateMappings');
  });

  describe('#getUserMapping', async () => {
    await itShouldCallTheRealUserControllerInstead('getUserMapping', 'mappings');
  });

  describe('#getUser', async () => {
    await itShouldCallTheRealUserControllerInstead('getUser', 'get');
  });

  describe('#mGetUsers', async () => {
    await itShouldCallTheRealUserControllerInstead('mGetUsers', 'mGet');
  });

  describe('#search', async () => {
    await itShouldCallTheRealUserControllerInstead('scrollUsers', 'search');
  });

  describe('#scrollUsers', async () => {
    await itShouldCallTheRealUserControllerInstead('scrollUsers', 'scroll');
  });

  describe('#deleteUser', async () => {
    await itShouldCallTheRealUserControllerInstead('deleteUser', 'delete');
  });

  describe('#createUser', async () => {
    await itShouldCallTheRealUserControllerInstead('createUser', 'create');
  });

  describe('#createRestrictedUser', async () => {
    await itShouldCallTheRealUserControllerInstead('createRestrictedUser', 'createRestricted');
  });

  describe('#updateUser', async () => {
    await itShouldCallTheRealUserControllerInstead('updateUser', 'update');
  });

  describe('#replaceUser', async () => {
    await itShouldCallTheRealUserControllerInstead('replaceUser', 'replace');
  });

  describe('#getUserStrategies', async () => {
    await itShouldCallTheRealUserControllerInstead('getUserStrategies', 'strategies');
  });

  describe('#getUserRights', async () => {
    await itShouldCallTheRealUserControllerInstead('getUserRights', 'rights');
  });

  describe('#mDeleteUser', () => {
    await itShouldCallTheRealUserControllerInstead('getUserRights', 'mDelete');
  });

  describe('#revokeTokens', () => {
    beforeEach(() => {
      request.input.args._id = 'test';
    });

    it('should revoke all tokens related to a given user', async () => {
      await securityController.revokeTokens(request);

      should(kuzzle.ask).calledWithMatch(
        'core:security:token:deleteByKuid',
        request.input.args._id);
    });

    it('should reject if no id is provided', async () => {
      request.input.args._id = null;

      await should(securityController.revokeTokens(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should forward security module exceptions', () => {
      const error = new Error('foo');

      kuzzle.ask
        .withArgs('core:security:token:deleteByKuid', request.input.args._id)
        .rejects(error);

      return should(securityController.revokeTokens(request))
        .rejectedWith(error);
    });
  });

  describe('#createFirstAdmin', () => {
    const adminExistsEvent = 'core:security:user:admin:exist';
    const createOrReplaceRoleEvent = 'core:security:role:createOrReplace';
    const createOrReplaceProfileEvent = 'core:security:profile:createOrReplace';
    let createOrReplaceRoleStub;
    let createOrReplaceProfileStub;
    let adminExistsStub;

    beforeEach(() => {
      sinon.stub(securityController, '_persistUser');

      request.input.args._id = 'test';

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

      should(securityController._persistUser).not.called();
      should(createOrReplaceRoleStub).not.called();
      should(createOrReplaceProfileStub).not.called();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', async () => {
      request.input.body = { content: { foo: 'bar' } };

      await securityController.createFirstAdmin(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['admin'], request.input.body.content);

      should(createOrReplaceRoleStub).not.called();
      should(createOrReplaceProfileStub).not.called();
    });

    it('should create the admin user and reset roles & profiles if asked to', async () => {
      request.input.args.reset = true;

      await securityController.createFirstAdmin(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['admin'], {});

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
});
