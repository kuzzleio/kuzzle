'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  BadRequestError,
  PluginImplementationError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const UserController = require('../../../lib/api/controllers/userController');
const User = require('../../../lib/model/security/user');

describe('UserController', () => {
  let kuzzle;
  let request;
  let userController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    userController = new UserController();
    userController.anonymousId = '-1';
    request = new Request({ controller: 'user' }, { user: new User() });

    request.context.user._id = '4';
  });

  describe('#create', () => {
    const createdUser = {_id: 'foo', _source: { bar: 'baz' } };

    beforeEach(() => {
      sinon.stub(userController, '_persistUser').resolves(createdUser);
      request.input.resource._id = 'test';
      request.input.body = {
        content: { name: 'John Doe', profileIds: ['default'] }
      };
    });

    it('should return a valid response', async () => {
      const response = await userController.create(request);

      should(userController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['default'], { name: 'John Doe' });

      should(response).eql(createdUser);
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(userController.create(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(userController._persistUser).not.called();
    });

    it('should reject if no profileId is given', async () => {
      delete request.input.body.content.profileIds;

      await should(userController.create(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.content.profileIds".'
        });

      should(userController._persistUser).not.called();
    });

    it('should reject if profileIds is not an array', async () => {
      request.input.body.content.profileIds = {};

      await should(userController.create(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "body.content.profileIds" (expected: array)'
        });

      should(userController._persistUser).not.called();
    });
  });

  describe('#_persistUser', () => {
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
      request.input.resource._id = 'test';
      request.input.body = {
        content: {name: 'John Doe', profileIds},
        credentials: {someStrategy: {some: 'credentials'}}
      };
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      fakeUser = new User();
      createStub = kuzzle.ask
        .withArgs(createEvent, request.input.resource._id, profileIds, content)
        .resolves(fakeUser);
      deleteStub = kuzzle.ask
        .withArgs(deleteEvent, request.input.resource._id, sinon.match.object)
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

      await should(userController._persistUser(request, profileIds, content))
        .be.rejectedWith(BadRequestError, {
          id: 'security.credentials.unknown_strategy'
        });

      should(createStub).not.called();
      should(deleteStub).not.called();
    });

    it('should reject if credentials already exist on the provided user id', async () => {
      strategyExistsStub.resolves(true);

      await should(userController._persistUser(request, profileIds, content))
        .be.rejectedWith(PluginImplementationError, {
          id: 'security.credentials.database_inconsistency'
        });

      should(createStub).not.called();
      should(deleteStub).not.called();
    });

    it('should rollback if credentials don\'t validate the strategy', async () => {
      strategyValidateStub.rejects(new Error('error'));

      await should(userController._persistUser(request, profileIds, content))
        .be.rejectedWith(BadRequestError, {
          id: 'security.credentials.rejected'
        });

      should(kuzzle.ask).calledWithMatch(
        createEvent,
        request.input.resource._id,
        profileIds,
        content,
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWithMatch(
        deleteEvent,
        request.input.resource._id,
        { refresh: 'false' });
    });

    it('should reject and rollback if credentials don\'t create properly', async () => {
      strategyCreateStub.rejects(new Error('some error'));

      await should(userController._persistUser(request, profileIds, content))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.runtime.unexpected_error',
        });

      should(kuzzle.ask).calledWithMatch(
        deleteEvent,
        request.input.resource._id,
        { refresh: 'false' });
    });

    it('should not create credentials if user creation fails', async () => {
      const error = new Error('error');
      createStub.rejects(error);

      await should(userController._persistUser(request, profileIds, content))
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

      await should(userController._persistUser(request, profileIds, content))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.runtime.unexpected_error',
          message: /.*oh noes\nsomeStrategy delete error\n.*/,
        });

      should(strategyDeleteStub).calledWithMatch(
        request,
        request.input.resource._id,
        'someStrategy');
    });

    it('should return the plugin error if it threw a KuzzleError error', async () => {
      const error = new BadRequestError('foo');

      strategyValidateStub.rejects(error);

      await should(userController._persistUser(request, profileIds, content))
        .be.rejectedWith(error);

      strategyValidateStub.resolves();
      strategyCreateStub.rejects(error);

      await should(userController._persistUser(request, profileIds, content))
        .be.rejectedWith(error);
    });
  });
});