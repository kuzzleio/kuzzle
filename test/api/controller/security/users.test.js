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

const SecurityController = require('../../../../lib/api/controller/security');
const User = require('../../../../lib/model/security/user');

describe('Test: security controller - users', () => {
  let kuzzle;
  let request;
  let securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    securityController = new SecurityController(kuzzle);
    request = new Request(
      {controller: 'security'},
      {user: new User()});

    // Random number chosen by fair dice roll. Guaranteed to be random.
    // (xkcd #221)
    request.context.user._id = '4';
  });

  describe('#checkRights', () => {
    let user;

    beforeEach(() => {
      user = {
        isActionAllowed: sinon.stub().resolves(true)
      };

      kuzzle.ask
        .withArgs('core:security:user:get')
        .resolves(user);

      request.input.args.userId = 'melis';

      request.input.body = {
        request: {
          controller: 'document',
          action: 'create'
        }
      };
    });

    it('should check if the action is allowed for the provided userId', async () => {
      const response = await securityController.checkRights(request);

      should(kuzzle.ask).be.calledWith('core:security:user:get', 'melis');

      should(user.isActionAllowed).be.calledWithMatch({
        input: {
          controller: 'document',
          action: 'create',
        }
      });
      should(response).be.eql({ allowed: true });
    });

    it('should reject if the provided request is not valid', async () => {
      request.input.body.request.controller = null;

      await should(securityController.checkRights(request))
        .be.rejectedWith({ id: 'api.assert.missing_argument' });

      request.input.body.request.controller = 'document';
      request.input.body.request.action = null;

      await should(securityController.checkRights(request))
        .be.rejectedWith({ id: 'api.assert.missing_argument' });
    });
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

      await should(securityController._persistUser(request, profileIds, content))
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
        request.input.resource._id,
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

  describe('#updateUserMapping', () => {
    const foo = {foo: 'bar'};

    it('should reject if the body is missing', () => {
      return should(securityController.updateUserMapping(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required'});
    });

    it('should update the user mapping', async () => {
      request.input.body = foo;
      kuzzle.ask.withArgs('core:storage:private:mappings:update').resolves(foo);

      const response = await securityController.updateUserMapping(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:private:mappings:update',
        kuzzle.internalIndex.index,
        'users',
        request.input.body);

      should(response).eql(foo);
    });
  });

  describe('#getUserMapping', () => {
    it('should fulfill with a response object', async () => {
      kuzzle.ask.withArgs('core:storage:private:mappings:get').resolves({
        properties: { foo: 'bar' },
      });

      const response = await securityController.getUserMapping(request);

      should(kuzzle.ask).calledWith(
        'core:storage:private:mappings:get',
        kuzzle.internalIndex.index,
        'users');

      should(response).match({ mapping: { foo: 'bar' } });
    });
  });

  describe('#getUser', () => {
    it('should reject if no id is given', () => {
      return should(securityController.getUser(request))
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

      const response = await securityController.getUser(request);

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

      return should(securityController.getUser(request)).rejectedWith(error);
    });
  });

  describe('#mGetUsers', () => {
    const mGetEvent = 'core:security:user:mGet';
    let mGetResult;
    let mGetStub;

    beforeEach(() => {
      request.input.body = { ids: ['foo', 'bar'] };

      mGetResult = [new User(), new User(), new User()];
      mGetResult[0]._id = 'foo';
      mGetResult[1]._id = 'bar';
      mGetResult[2]._id = 'baz';

      mGetStub = kuzzle.ask.withArgs(mGetEvent).resolves(mGetResult);
    });

    it('should reject if no ids are given', async () => {
      delete request.input.body.ids;

      await should(securityController.mGetUsers(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "ids".'
        });

      should(mGetStub).not.called();
    });

    it('should return a valid response', async () => {
      const result = await securityController.mGetUsers(request);

      should(mGetStub).calledWith(mGetEvent, request.input.body.ids);

      should(result).match({
        hits: [
          { _id: 'foo', _source: { profileIds: [] } },
          { _id: 'bar', _source: { profileIds: [] } },
          { _id: 'baz', _source: { profileIds: [] } },
        ],
      });
    });

    it('should accept ids given as an args string', async () => {
      request.input.body = null;
      request.input.args.ids = 'user1,user2';

      const result = await securityController.mGetUsers(request);

      should(mGetStub).calledWithMatch(mGetEvent, ['user1', 'user2']);

      should(result).match({
        hits: [
          { _id: 'foo', _source: { profileIds: [] } },
          { _id: 'bar', _source: { profileIds: [] } },
          { _id: 'baz', _source: { profileIds: [] } },
        ],
      });
    });
  });

  describe('#searchUsers', () => {
    const searchEvent = 'core:security:user:search';
    let searchStub;

    beforeEach(() => {
      request.input.body = { query: {foo: 'bar' } };
      request.input.args.from = 13;
      request.input.args.size = 42;
      request.input.args.scroll = 'foo';

      searchStub = kuzzle.ask
        .withArgs(searchEvent)
        .resolves({
          hits: [{ _id: 'admin', _source: { profileIds: ['admin'] } }],
          total: 2,
          scrollId: 'foobar'
        });
    });

    it('should return a valid responseObject', async () => {
      const response = await securityController.searchUsers(request);

      should(searchStub).be.calledWithMatch(
        searchEvent,
        request.input.body,
        {from: 13, size: 42, scroll: 'foo'});

      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should handle empty body requests', async () => {
      request.input.body = null;

      const response = await securityController.searchUsers(new Request({}));

      should(searchStub).be.calledWithMatch(searchEvent, {}, {});

      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should allow `aggregations` and `highlight` arguments', async () => {
      request.input.body = {aggregations: 'aggregations'};

      await securityController.searchUsers(request);

      should(searchStub).be.calledWithMatch(
        searchEvent,
        { aggregations: 'aggregations' },
        {
          from: request.input.args.from,
          size: request.input.args.size,
          scroll: request.input.args.scroll,
        });

      // highlight only
      searchStub.resetHistory();
      request.input.body = {highlight: 'highlight'};
      await securityController.searchUsers(request);

      should(searchStub).be.calledWithMatch(
        searchEvent,
        { highlight: 'highlight' },
        {
          from: request.input.args.from,
          size: request.input.args.size,
          scroll: request.input.args.scroll,
        });

      // all in one
      searchStub.resetHistory();
      request.input.body = {
        query: { match_all: {} },
        aggregations: 'aggregations',
        highlight: 'highlight'
      };

      await securityController.searchUsers(request);

      should(searchStub).be.calledWithMatch(
        searchEvent,
        {
          aggregations: 'aggregations',
          highlight: 'highlight',
          query: { match_all: {} },
        },
        {
          from: request.input.args.from,
          size: request.input.args.size,
          scroll: request.input.args.scroll,
        });
    });

    it('should reject if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request = new Request({ size: 10 });

      return should(securityController.searchUsers(request))
        .rejectedWith(SizeLimitError, {
          id: 'services.storage.get_limit_exceeded'
        });
    });

    it('should forward a security module exception', () => {
      const error = new Error('Mocked error');
      searchStub.rejects(error);

      return should(securityController.searchUsers(request))
        .be.rejectedWith(error);
    });
  });

  describe('#scrollUsers', () => {
    const scrollEvent = 'core:security:user:scroll';
    let scrollStub;

    beforeEach(() => {
      request.input.args.scrollId = 'foobar';
      scrollStub = kuzzle.ask
        .withArgs(scrollEvent)
        .resolves({
          hits: [{ _id: 'admin', _source: { profileIds: ['admin'] } }],
          total: 2,
          scrollId: 'foobar'
        });
    });

    it('should reject if no scrollId is provided', () => {
      request.input.args.scrollId = null;

      return should(securityController.scrollUsers(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reformat search results correctly', async () => {
      const response = await securityController.scrollUsers(request);

      should(scrollStub).be.calledWith(scrollEvent, 'foobar', undefined);
      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should handle the scroll argument', async () => {
      request.input.args.scroll = 'qux';

      const response = await securityController.scrollUsers(request);

      should(scrollStub).be.calledWith(scrollEvent, 'foobar', 'qux');
      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });
  });

  describe('#deleteUser', () => {
    const deleteEvent = 'core:security:user:delete';
    let deleteStub;

    beforeEach(() => {
      deleteStub = kuzzle.ask.withArgs(deleteEvent).resolves();

      request.input.resource._id = 'test';
    });

    it('should return a valid response', async () => {
      const response = await securityController.deleteUser(request);

      should(deleteStub).calledWithMatch(deleteEvent, 'test', {
        refresh: 'wait_for',
      });

      should(response._id).be.exactly('test');
    });

    it('should reject if no id is given', async () => {
      request.input.resource._id = null;

      await should(securityController.deleteUser(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(deleteStub).not.called();
    });

    it('should forward exceptions from the security module', () => {
      const error = new Error('Mocked error');
      deleteStub.rejects(error);

      return should(securityController.deleteUser(new Request({_id: 'test'})))
        .be.rejectedWith(error);
    });

    it('should handle the refresh option', async () => {
      request.input.args.refresh = false;

      await securityController.deleteUser(request);

      should(deleteStub).calledWithMatch(deleteEvent, 'test', {
        refresh: 'false',
      });
    });
  });

  describe('#createUser', () => {
    // api.security._persistUser has its own extensive tests above
    const createdUser = {_id: 'foo', _source: { bar: 'baz' } };

    beforeEach(() => {
      sinon.stub(securityController, '_persistUser').resolves(createdUser);
      request.input.resource._id = 'test';
      request.input.body = {
        content: { name: 'John Doe', profileIds: ['default'] }
      };
    });

    it('should return a valid response', async () => {
      const response = await securityController.createUser(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['default'], { name: 'John Doe' });

      should(response).eql(createdUser);
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(securityController.createUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(securityController._persistUser).not.called();
    });

    it('should reject if no profileId is given', async () => {
      delete request.input.body.content.profileIds;

      await should(securityController.createUser(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.content.profileIds".'
        });

      should(securityController._persistUser).not.called();
    });

    it('should reject if profileIds is not an array', async () => {
      request.input.body.content.profileIds = {};

      await should(securityController.createUser(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "body.content.profileIds" (expected: array)'
        });

      should(securityController._persistUser).not.called();
    });
  });

  describe('#createRestrictedUser', () => {
    // api.security._persistUser has its own extensive tests above
    const createdUser = {_id: 'foo', _source: { bar: 'baz' } };

    beforeEach(() => {
      sinon.stub(securityController, '_persistUser').resolves(createdUser);
      request.input.resource._id = 'test';
      request.input.body = {
        content: { name: 'John Doe' }
      };

      kuzzle.config.security.restrictedProfileIds = [ 'foo', 'bar' ];
    });

    it('should return a valid response', async () => {
      const response = await securityController.createRestrictedUser(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(
          request,
          kuzzle.config.security.restrictedProfileIds,
          { name: 'John Doe' });

      should(securityController._persistUser.firstCall.args[2])
        .not.have.ownProperty('profileIds');

      should(response).eql(createdUser);
    });

    it('should reject if profileIds are given', async () => {
      request.input.body.content.profileIds = [ 'ohnoes' ];

      await should(securityController.createRestrictedUser(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.forbidden_argument',
          message: 'The argument "body.content.profileIds" is not allowed by this API action.'
        });

      should(securityController._persistUser).not.called();
    });

    it('should allow the request to not have a body content', async () => {
      request.input.body = null;

      const response = await securityController.createRestrictedUser(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(
          request,
          kuzzle.config.security.restrictedProfileIds,
          {});

      should(securityController._persistUser.firstCall.args[2])
        .not.have.ownProperty('profileIds');

      should(response).eql(createdUser);
    });
  });

  describe('#updateUser', () => {
    const updateEvent = 'core:security:user:update';
    let updateStub;
    let updatedUser;

    beforeEach(() => {
      request.input.resource._id = 'test';
      request.input.body = { foo: 'bar' };

      updatedUser = new User();
      updatedUser._id = request.input.resource._id;

      updateStub = kuzzle.ask
        .withArgs(updateEvent, request.input.resource._id)
        .resolves(updatedUser);
    });

    it('should return a valid response and use default options', async () => {
      const updatedUserContent = {foo: 'bar', baz: 'qux'};

      Object.assign(updatedUser, updatedUserContent);

      const response = await securityController.updateUser(request);

      should(updateStub).calledWithMatch(
        updateEvent,
        'test',
        null,
        { foo: 'bar' },
        {
          refresh: 'wait_for',
          retryOnConflict: 10,
          userId: request.context.user._id,
        });

      should(response).be.an.Object().and.not.instanceof(User);
      should(response).match({
        _id: updatedUser._id,
        _source: updatedUserContent,
      });
    });

    it('should reject if no id is given', async () => {
      request.input.resource._id = null;

      await should(securityController.updateUser(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(updateStub).not.called();
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(securityController.updateUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(updateStub).not.called();
    });

    it('should forward the provided options to the security module', async () => {
      request.input.args.refresh = false;
      request.input.args.retryOnConflict = 123;

      await securityController.updateUser(request);

      should(updateStub).calledWithMatch(
        updateEvent,
        'test',
        null,
        { foo: 'bar' },
        {
          refresh: 'false',
          retryOnConflict: 123,
          userId: request.context.user._id,
        });
    });

    it('should reject if the security module throws', () => {
      const error = new Error('foo');
      updateStub.rejects(error);

      return should(securityController.updateUser(request)).rejectedWith(error);
    });
  });

  describe('#replaceUser', () => {
    const replaceEvent = 'core:security:user:replace';
    let replaceStub;
    let replacedUser;

    beforeEach(() => {
      request.input.resource._id = 'test';
      request.input.body = { foo: 'bar', profileIds: ['qux'] };

      replacedUser = new User();

      replaceStub = kuzzle.ask
        .withArgs(replaceEvent, request.input.resource._id)
        .resolves(replacedUser);
    });

    it('should reject if the request does not have a body', async () => {
      request.input.body = null;

      await should(securityController.replaceUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(replaceStub).not.called();
    });

    it('should reject if there is no id provided', async () => {
      request.input.resource._id = null;

      await should(securityController.replaceUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });

      should(replaceStub).not.called();
    });

    it('should reject if the content does not have a profileIds attribute', async () => {
      request.input.body.profileIds = null;

      await should(securityController.replaceUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject if the provided profileIds attribute is not an array', async () => {
      request.input.body.profileIds = {};

      await should(securityController.replaceUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should reject if the security module throws', async () => {
      const error = new Error('foo');

      replaceStub.rejects(error);

      await should(securityController.replaceUser(request)).rejectedWith(error);
    });

    it('should correctly process the request', async () => {
      const replacedUserContent = {
        baz: 'qux',
        foo: 'bar',
        profileIds: request.input.body.profileIds,
      };

      Object.assign(
        replacedUser,
        {_id: request.input.resource._id},
        replacedUserContent);

      const response = await securityController.replaceUser(request);

      should(replaceStub).calledWithMatch(
        replaceEvent,
        request.input.resource._id,
        request.input.body.profileIds,
        request.input.body,
        {
          refresh: 'wait_for',
          userId: request.context.user._id,
        });

      should(response).be.an.Object().and.not.instanceof(User);
      should(response).match({
        _id: request.input.resource._id,
        _source: replacedUserContent
      });
    });

    it('should handle request options', async () => {
      request.input.args.refresh = false;

      await securityController.replaceUser(request);

      should(replaceStub).calledWithMatch(
        replaceEvent,
        request.input.resource._id,
        request.input.body.profileIds,
        request.input.body,
        {
          refresh: 'false',
          userId: request.context.user._id,
        });
    });
  });

  describe('#getUserRights', () => {
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

    it('should resolve to an object on a getUserRights call', async () => {
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

      const response = await securityController.getUserRights(request);

      should(getStub).calledWith(getEvent, request.input.resource._id);

      should(response).be.an.Object().and.not.empty();
      should(response.hits).be.an.Array().and.have.length(2);
      should(response.total).eql(2);

      should(response.hits.includes(rights.rights1)).be.true();
      should(response.hits.includes(rights.rights2)).be.true();
    });

    it('should reject if no id is provided', async () => {
      request.input.resource._id = null;

      await should(securityController.getUserRights(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(getStub).not.called();
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      getStub.rejects(error);

      return should(securityController.getUserRights(request))
        .rejectedWith(error);
    });
  });

  describe('#mDeleteUser', () => {
    it('should forward its args to mDelete', async () => {
      sinon.stub(securityController, '_mDelete').resolves('foobar');

      await should(securityController.mDeleteUsers(request))
        .fulfilledWith('foobar');

      should(securityController._mDelete)
        .be.calledOnce()
        .be.calledWith('user', request);
    });
  });

  describe('#revokeTokens', () => {
    beforeEach(() => {
      request.input.resource._id = 'test';
    });

    it('should revoke all tokens related to a given user', async () => {
      await securityController.revokeTokens(request);

      should(kuzzle.ask).calledWithMatch(
        'core:security:token:deleteByKuid',
        request.input.resource._id);
    });

    it('should reject if no id is provided', async () => {
      request.input.resource._id = null;

      await should(securityController.revokeTokens(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should forward security module exceptions', () => {
      const error = new Error('foo');

      kuzzle.ask
        .withArgs('core:security:token:deleteByKuid', request.input.resource._id)
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

      request.input.resource._id = 'test';

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
