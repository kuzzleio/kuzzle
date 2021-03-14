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

  describe('#createRestricted', () => {
    const createdUser = {_id: 'foo', _source: { bar: 'baz' } };

    beforeEach(() => {
      sinon.stub(userController, '_persistUser').resolves(createdUser);
      request.input.resource._id = 'test';
      request.input.body = {
        content: { name: 'John Doe' }
      };

      kuzzle.config.security.restrictedProfileIds = [ 'foo', 'bar' ];
    });

    it('should return a valid response', async () => {
      const response = await userController.createRestricted(request);

      should(userController._persistUser)
        .calledOnce()
        .calledWithMatch(
          request,
          kuzzle.config.security.restrictedProfileIds,
          { name: 'John Doe' });

      should(userController._persistUser.firstCall.args[2])
        .not.have.ownProperty('profileIds');

      should(response).eql(createdUser);
    });

    it('should reject if profileIds are given', async () => {
      request.input.body.content.profileIds = [ 'ohnoes' ];

      await should(userController.createRestricted(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.forbidden_argument',
          message: 'The argument "body.content.profileIds" is not allowed by this API action.'
        });

      should(userController._persistUser).not.called();
    });

    it('should allow the request to not have a body content', async () => {
      request.input.body = null;

      const response = await userController.createRestricted(request);

      should(userController._persistUser)
        .calledOnce()
        .calledWithMatch(
          request,
          kuzzle.config.security.restrictedProfileIds,
          {});

      should(userController._persistUser.firstCall.args[2])
        .not.have.ownProperty('profileIds');

      should(response).eql(createdUser);
    });
  });

  describe('#delete', () => {
    const deleteEvent = 'core:security:user:delete';
    let deleteStub;

    beforeEach(() => {
      deleteStub = kuzzle.ask.withArgs(deleteEvent).resolves();

      request.input.resource._id = 'test';
    });

    it('should return a valid response', async () => {
      const response = await userController.delete(request);

      should(deleteStub).calledWithMatch(deleteEvent, 'test', {
        refresh: 'wait_for',
      });

      should(response._id).be.exactly('test');
    });

    it('should reject if no id is given', async () => {
      request.input.resource._id = null;

      await should(userController.delete(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(deleteStub).not.called();
    });

    it('should forward exceptions from the security module', () => {
      const error = new Error('Mocked error');
      deleteStub.rejects(error);

      return should(userController.delete(new Request({_id: 'test'})))
        .be.rejectedWith(error);
    });

    it('should handle the refresh option', async () => {
      request.input.args.refresh = false;

      await userController.delete(request);

      should(deleteStub).calledWithMatch(deleteEvent, 'test', {
        refresh: 'false',
      });
    });
  });

  describe('#get', () => {
    it('should reject if no id is given', () => {
      return should(userController.get(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should load and return the requested user', async () => {
      const user = new User();

      user._id = 'foo';
      user.bar = 'baz';

      request.input.resource._id = 'foo';

      kuzzle.ask
        .withArgs('core:security:user:get', request.input.resource._id)
        .resolves(user);

      const response = await userController.get(request);

      should(response).match({
        _id: 'foo',
        _source: {bar: 'baz'},
      });
    });

    it('should forward errors from the security module', () => {
      request.input.resource._id = 'foo';

      const error = new Error('oh noes');

      kuzzle.ask
        .withArgs('core:security:user:get', request.input.resource._id)
        .rejects(error);

      return should(userController.get(request)).rejectedWith(error);
    });
  });

  describe('#rights', () => {
    const getEvent = 'core:security:user:get';
    let getStub;
    let returnedUser;

    beforeEach(() => {
      request.input.resource._id = 'test';

      returnedUser = new User();
      returnedUser._id = request.input.resource._id;
      sinon.stub(returnedUser, 'getRights');

      getStub = kuzzle.ask
        .withArgs(getEvent, request.input.resource._id)
        .resolves(returnedUser);
    });

    it('should resolve to an object on a rights call', async () => {
      const rights = {
        rights1: {
          action: 'action',
          collection: 'foo',
          controller: 'controller',
          index: 'index',
          value: true,
        },
        rights2: {
          action: 'action',
          collection: 'collection',
          controller: 'bar',
          index: 'index',
          value: false,
        }
      };

      returnedUser.getRights.returns(rights);

      const response = await userController.rights(request);

      should(getStub).calledWith(getEvent, request.input.resource._id);

      should(response).be.an.Object().and.not.empty();
      should(response.hits).be.an.Array().and.have.length(2);
      should(response.total).eql(2);

      should(response.hits.includes(rights.rights1)).be.true();
      should(response.hits.includes(rights.rights2)).be.true();
    });

    it('should reject if no id is provided', async () => {
      request.input.resource._id = null;

      await should(userController.rights(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(getStub).not.called();
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      getStub.rejects(error);

      return should(userController.rights(request))
        .rejectedWith(error);
    });
  });

  describe('#mapping', () => {
    it('should fulfill with a response object', async () => {
      kuzzle.ask.withArgs('core:storage:private:mappings:get').resolves({
        properties: { foo: 'bar' },
      });

      const response = await userController.mapping(request);

      should(kuzzle.ask).calledWith(
        'core:storage:private:mappings:get',
        kuzzle.internalIndex.index,
        'users');

      should(response).match({ mapping: { foo: 'bar' } });
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