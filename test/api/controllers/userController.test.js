'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  BadRequestError,
  SizeLimitError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const AbstractSecurityController = require('../../../lib/api/controllers/base/abstractSecurityController');
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

  describe('#constructor', () => {
    it('should inherit the abstract constructor', () => {
      should(new UserController()).instanceOf(AbstractSecurityController);
    });
  });

  describe('#create', () => {
    const createdUser = {_id: 'foo', _source: { bar: 'baz' } };
    const createEvent = 'core:security:user:create';
    let createStub;

    beforeEach(() => {
      createStub = kuzzle.ask.withArgs(createEvent).resolves(createdUser);
      request.input.args._id = 'test';
      request.input.body = {
        content: { name: 'John Doe', profileIds: ['default'] }
      };
    });

    it('should return a valid response', async () => {
      const response = await userController.create(request);

      should(createStub)
        .calledOnce()
        .calledWithMatch(createEvent, request, ['default'], { name: 'John Doe' });

      should(response).eql(createdUser);
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(userController.create(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(createStub).not.called();
    });

    it('should reject if no profileId is given', async () => {
      delete request.input.body.content.profileIds;

      await should(userController.create(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.content.profileIds".'
        });

      should(createStub).not.called();
    });

    it('should reject if profileIds is not an array', async () => {
      request.input.body.content.profileIds = {};

      await should(userController.create(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "body.content.profileIds" (expected: array)'
        });

      should(createStub).not.called();
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

      request.input.args._id = 'foo';

      kuzzle.ask
        .withArgs('core:security:user:get', request.input.args._id)
        .resolves(user);

      const response = await userController.get(request);

      should(response).match({
        _id: 'foo',
        _source: {bar: 'baz'},
      });
    });

    it('should forward errors from the security module', () => {
      request.input.args._id = 'foo';

      const error = new Error('oh noes');

      kuzzle.ask
        .withArgs('core:security:user:get', request.input.args._id)
        .rejects(error);

      return should(userController.get(request)).rejectedWith(error);
    });
  });

  describe('#mGet', () => {
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

      await should(userController.mGet(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "ids".'
        });

      should(mGetStub).not.called();
    });

    it('should return a valid response', async () => {
      const result = await userController.mGet(request);

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

      const result = await userController.mGet(request);

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

  describe('#search', () => {
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
      const response = await userController.search(request);

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

      const response = await userController.search(new Request({}));

      should(searchStub).be.calledWithMatch(searchEvent, {}, {});

      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should allow `aggregations` and `highlight` arguments', async () => {
      request.input.body = {aggregations: 'aggregations'};

      await userController.search(request);

      should(searchStub).be.calledWithMatch(
        searchEvent,
        { aggregations: 'aggregations' },
        {
          from: request.input.args.from,
          size: request.input.args.size,
          scroll: request.input.args.scroll,
        });

      // highlight
      searchStub.resetHistory();
      request.input.body = {highlight: 'highlight'};
      await userController.search(request);

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

      await userController.search(request);

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

      return should(userController.search(request))
        .rejectedWith(SizeLimitError, {
          id: 'services.storage.get_limit_exceeded'
        });
    });

    it('should forward a security module exception', () => {
      const error = new Error('Mocked error');
      searchStub.rejects(error);

      return should(userController.search(request))
        .be.rejectedWith(error);
    });

    it('should reject if the "lang" is not supported', () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.lang = 'turkish';

      return should(userController.search(request)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_argument' });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = { query: { equals: { name: 'Melis' } } };
      request.input.args.lang = 'koncorde';
      userController.translateKoncorde = sinon.stub().resolves();

      await userController.search(request);

      should(userController.translateKoncorde)
        .be.calledWith({ equals: { name: 'Melis' } });
    });
  });

  describe('#scroll', () => {
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

      return should(userController.scroll(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reformat search results correctly', async () => {
      const response = await userController.scroll(request);

      should(scrollStub).be.calledWith(scrollEvent, 'foobar', undefined);
      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should handle the scroll argument', async () => {
      request.input.args.scroll = 'qux';

      const response = await userController.scroll(request);

      should(scrollStub).be.calledWith(scrollEvent, 'foobar', 'qux');
      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });
  });

  describe('#update', () => {
    const updateEvent = 'core:security:user:update';
    let updateStub;
    let updatedUser;

    beforeEach(() => {
      request.input.args._id = 'test';
      request.input.body = { foo: 'bar' };

      updatedUser = new User();
      updatedUser._id = request.input.args._id;

      updateStub = kuzzle.ask
        .withArgs(updateEvent, request.input.args._id)
        .resolves(updatedUser);
    });

    it('should return a valid response and use default options', async () => {
      const updatedUserContent = {foo: 'bar', baz: 'qux'};

      Object.assign(updatedUser, updatedUserContent);

      const response = await userController.update(request);

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
      request.input.args._id = null;

      await should(userController.update(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(updateStub).not.called();
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(userController.update(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(updateStub).not.called();
    });

    it('should forward the provided options to the security module', async () => {
      request.input.args.refresh = false;
      request.input.args.retryOnConflict = 123;

      await userController.update(request);

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

      return should(userController.update(request)).rejectedWith(error);
    });
  });

  describe('#replace', () => {
    const replaceEvent = 'core:security:user:replace';
    let replaceStub;
    let replacedUser;

    beforeEach(() => {
      request.input.args._id = 'test';
      request.input.body = { foo: 'bar', profileIds: ['qux'] };

      replacedUser = new User();

      replaceStub = kuzzle.ask
        .withArgs(replaceEvent, request.input.args._id)
        .resolves(replacedUser);
    });

    it('should reject if the request does not have a body', async () => {
      request.input.body = null;

      await should(userController.replace(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(replaceStub).not.called();
    });

    it('should reject if there is no id provided', async () => {
      request.input.args._id = null;

      await should(userController.replace(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });

      should(replaceStub).not.called();
    });

    it('should reject if the content does not have a profileIds attribute', async () => {
      request.input.body.profileIds = null;

      await should(userController.replace(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject if the provided profileIds attribute is not an array', async () => {
      request.input.body.profileIds = {};

      await should(userController.replace(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should reject if the security module throws', async () => {
      const error = new Error('foo');

      replaceStub.rejects(error);

      await should(userController.replace(request)).rejectedWith(error);
    });

    it('should correctly process the request', async () => {
      const replacedUserContent = {
        baz: 'qux',
        foo: 'bar',
        profileIds: request.input.body.profileIds,
      };

      Object.assign(
        replacedUser,
        {_id: request.input.args._id},
        replacedUserContent);

      const response = await userController.replace(request);

      should(replaceStub).calledWithMatch(
        replaceEvent,
        request.input.args._id,
        request.input.body.profileIds,
        request.input.body,
        {
          refresh: 'wait_for',
          userId: request.context.user._id,
        });

      should(response).be.an.Object().and.not.instanceof(User);
      should(response).match({
        _id: request.input.args._id,
        _source: replacedUserContent
      });
    });

    it('should handle request options', async () => {
      request.input.args.refresh = false;

      await userController.replace(request);

      should(replaceStub).calledWithMatch(
        replaceEvent,
        request.input.args._id,
        request.input.body.profileIds,
        request.input.body,
        {
          refresh: 'false',
          userId: request.context.user._id,
        });
    });
  });

  describe('#delete', () => {
    const deleteEvent = 'core:security:user:delete';
    let deleteStub;

    beforeEach(() => {
      deleteStub = kuzzle.ask.withArgs(deleteEvent).resolves();

      request.input.args._id = 'test';
    });

    it('should return a valid response', async () => {
      const response = await userController.delete(request);

      should(deleteStub).calledWithMatch(deleteEvent, 'test', {
        refresh: 'wait_for',
      });

      should(response._id).be.exactly('test');
    });

    it('should reject if no id is given', async () => {
      request.input.args._id = null;

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

  describe('#mDelete', () => {

    it('should forward its args to _mDelete', async () => {
      sinon.stub(userController, '_mDelete').resolves('foobar');

      await should(userController.mDelete(request))
        .fulfilledWith('foobar');

      should(userController._mDelete)
        .be.calledOnce()
        .be.calledWith('user', request);
    });
  });

  describe('#getMappings', () => {
    const result = {
      dynamic: 'false',
      _meta: { some: 'metadata' },
      properties: { foo: 'bar' },
    };

    it('should fulfill with a response object', async () => {
      kuzzle.ask.withArgs('core:storage:private:mappings:get').resolves(result);

      const response = await userController.getMappings(request);

      should(kuzzle.ask).calledWith(
        'core:storage:private:mappings:get',
        kuzzle.internalIndex.index,
        'users');

      should(response).match(result);
    });
  });

  describe('#updateMappings', () => {
    const foo = { foo: 'bar' };

    it('should reject if the body is missing', () => {
      return should(userController.updateMappings(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required'});
    });

    it('should update the user mapping', async () => {
      request.input.body = foo;
      kuzzle.ask.withArgs('core:storage:private:mappings:update').resolves(foo);

      const response = await userController.updateMappings(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:private:mappings:update',
        kuzzle.internalIndex.index,
        'users',
        request.input.body);

      should(response).eql(foo);
    });
  });

  describe('#getRights', () => {
    const getEvent = 'core:security:user:get';
    let getStub;
    let returnedUser;

    beforeEach(() => {
      request.input.args._id = 'test';

      returnedUser = new User();
      returnedUser._id = request.input.args._id;
      sinon.stub(returnedUser, 'getRights');

      getStub = kuzzle.ask
        .withArgs(getEvent, request.input.args._id)
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

      const response = await userController.getRights(request);

      should(getStub).calledWith(getEvent, request.input.args._id);

      should(response).be.an.Object().and.not.empty();
      should(response.rights).be.an.Array().and.have.length(2);

      should(response.rights.includes(rights.rights1)).be.true();
      should(response.rights.includes(rights.rights2)).be.true();
    });

    it('should reject if no id is provided', async () => {
      request.input.args._id = null;

      await should(userController.getRights(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(getStub).not.called();
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      getStub.rejects(error);

      return should(userController.getRights(request))
        .rejectedWith(error);
    });
  });

  describe('#isAllowed', () => {
    let user;

    beforeEach(() => {
      user = {
        isActionAllowed: sinon.stub().resolves(true)
      };

      kuzzle.ask
        .withArgs('core:security:user:get')
        .resolves(user);

      request.input.args._id = 'melis';

      request.input.body = {
        controller: 'document',
        action: 'create'
      };
    });

    it('should check if the action is allowed for the provided user id', async () => {
      const response = await userController.isAllowed(request);

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
      request.input.body.controller = null;

      await should(userController.isAllowed(request))
        .be.rejectedWith({ id: 'api.assert.missing_argument' });

      request.input.body.controller = 'document';
      request.input.body.action = null;

      await should(userController.isAllowed(request))
        .be.rejectedWith({ id: 'api.assert.missing_argument' });
    });
  });

  describe('#getStrategies', () => {
    const getEvent = 'core:security:user:get';
    const exampleStrategy = 'someStrategy';
    const returnedUser = new User();
    let getStub;

    beforeEach(() => {
      request.input.args._id = 'test';
      returnedUser._id = request.input.args._id;
      getStub = kuzzle.ask
        .withArgs(getEvent, request.input.args._id)
        .resolves(returnedUser);

      kuzzle.pluginsManager.listStrategies.returns([exampleStrategy]);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs(exampleStrategy, 'exists')
        .returns(sinon.stub().resolves(true));
    });

    it('should return a list of strategies', async () => {
      const response = await userController.getStrategies(request);

      should(response).be.an.Object().and.not.empty();
      should(response.strategies).be.an.Array().and.have.length(1);
      should(response.strategies.includes(exampleStrategy)).be.true();
    });

    it('should return empty when anonymous id is provided', async () => {
      request.input.args._id = '-1';

      const response = await userController.getStrategies(request);

      should(response).be.an.Object().and.not.empty();
      should(response.strategies).be.an.Array().and.have.length(0);
    });

    it('should reject if user is not found', async () => {
      const error = new Error('foo');
      request.input.args._id = 'alyx';

      getStub
        .withArgs(getEvent, request.input.args._id)
        .rejects(error);

      await should(userController.getStrategies(request))
        .rejectedWith(error);
    });

    it('should reject if no id is provided', async () => {
      request.input.args._id = null;

      await should(userController.getStrategies(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      should(getStub).not.called();
    });
  });

  describe('#revokeTokens', () => {
    beforeEach(() => {
      request.input.args._id = 'test';
    });

    it('should revoke all tokens related to a given user', async () => {
      await userController.revokeTokens(request);

      should(kuzzle.ask).calledWithMatch(
        'core:security:token:deleteByKuid',
        request.input.args._id);
    });

    it('should reject if no id is provided', async () => {
      request.input.args._id = null;

      await should(userController.revokeTokens(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should forward security module exceptions', () => {
      const error = new Error('foo');

      kuzzle.ask
        .withArgs('core:security:token:deleteByKuid', request.input.args._id)
        .rejects(error);

      return should(userController.revokeTokens(request))
        .rejectedWith(error);
    });
  });

  describe('#refresh', () => {
    it('should forward its args to _refresh', async () => {
      sinon.stub(userController, '_mDelete').resolves('foobar');

      await should(userController.mDelete(request))
        .fulfilledWith('foobar');

      should(userController._mDelete)
        .be.calledOnce()
        .be.calledWith('user', request);
    });
  });
});