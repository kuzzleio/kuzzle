'use strict';

const should = require('should');
const Bluebird = require('bluebird');
const sinon = require('sinon');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const {
  Request,
  errors: {
    BadRequestError,
    SizeLimitError
  }
} = require('kuzzle-common-objects');
const SecurityController = require('../../../../lib/api/controller/security');
const Role = require('../../../../lib/model/security/role');

describe('Test: security controller - roles', () => {
  let kuzzle;
  let request;
  let securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);

    request = new Request(
      {controller: 'security'},
      {user: { _id: '4' } });
  });

  describe('#updateRoleMapping', () => {
    it('should throw a BadRequestError if the body is missing', async () => {
      await should(securityController.updateRoleMapping(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(kuzzle.internalIndex.updateMapping).not.called();
    });

    it('should update the role mapping', async () => {
      request.input.body = { foo: 'bar' };
      kuzzle.internalIndex.updateMapping.resolves(request.input.body);

      const response = await securityController.updateRoleMapping(request);

      should(kuzzle.internalIndex.updateMapping)
        .calledOnce()
        .calledWith('roles', request.input.body);

      should(response).match(request.input.body);
    });
  });

  describe('#getRoleMapping', () => {
    it('should fulfill with a response object', async () => {
      kuzzle.internalIndex.getMapping.resolves({ properties: { foo: 'bar' } });

      const response = await securityController.getRoleMapping(request);

      should(kuzzle.internalIndex.getMapping)
        .be.calledOnce()
        .be.calledWith('roles');

      should(response).match({ mapping: { foo: 'bar' } });
    });
  });

  describe('#createOrReplaceRole', () => {
    const createOrReplaceEvent = 'core:security:role:createOrReplace';
    let createOrReplaceStub;

    beforeEach(() => {
      request.input.resource._id = 'test';
      request.input.body = { foo: 'bar' };

      createOrReplaceStub = kuzzle.ask
        .withArgs(
          createOrReplaceEvent,
          request.input.resource._id,
          sinon.match.object,
          sinon.match.object);
    });

    it('should create a role using default options', async () => {
      let createdRole = new Role();
      createdRole._id = request.input.resource._id;
      createdRole._source = request.input.body;

      createOrReplaceStub.resolves(createdRole);

      const response = await securityController.createOrReplaceRole(request);

      should(createOrReplaceStub).calledWithMatch(
        createOrReplaceEvent,
        request.input.resource._id,
        request.input.body,
        {
          force: false,
          refresh: 'wait_for',
          userId: request.context.user._id,
        });

      should(response).be.an.Object().and.not.instanceof(Role);
      should(response._id).eql(createdRole._id);
      should(response._source).match(createdRole._source);
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      createOrReplaceStub.rejects(error);

      return should(securityController.createOrReplaceRole(request))
        .be.rejectedWith(error);
    });

    it('should forward request options', async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;

      await securityController.createOrReplaceRole(request);

      should(createOrReplaceStub).calledWithMatch(
        createOrReplaceEvent,
        request.input.resource._id,
        request.input.body,
        {
          force: false,
          refresh: 'wait_for',
          userId: request.context.user._id,
        });
    });

    it('should reject if no id is provided', async () => {
      request.input.resource._id = null;

      await should(securityController.createOrReplaceRole(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });

      should(createOrReplaceStub).not.called();
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(securityController.createOrReplaceRole(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(createOrReplaceStub).not.called();
    });
  });

  describe('#createRole', () => {
    const createEvent = 'core:security:role:create';
    let createStub;

    beforeEach(() => {
      request.input.resource._id = 'test';
      request.input.body = { foo: 'bar' };

      createStub = kuzzle.ask
        .withArgs(
          createEvent,
          request.input.resource._id,
          sinon.match.object,
          sinon.match.object);
    });

    it('should create a role using default options', async () => {
      let createdRole = new Role();
      createdRole._id = request.input.resource._id;
      createdRole._source = request.input.body;

      createStub.resolves(createdRole);

      const response = await securityController.createRole(request);

      should(createStub).calledWithMatch(
        createEvent,
        request.input.resource._id,
        request.input.body,
        {
          force: false,
          refresh: 'wait_for',
          userId: request.context.user._id,
        });

      should(response).be.an.Object().and.not.instanceof(Role);
      should(response._id).eql(createdRole._id);
      should(response._source).match(createdRole._source);
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      createStub.rejects(error);

      return should(securityController.createRole(request))
        .be.rejectedWith(error);
    });

    it('should forward request options', async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;

      await securityController.createRole(request);

      should(createStub).calledWithMatch(
        createEvent,
        request.input.resource._id,
        request.input.body,
        {
          force: false,
          refresh: 'wait_for',
          userId: request.context.user._id,
        });
    });

    it('should reject if no id is provided', async () => {
      request.input.resource._id = null;

      await should(securityController.createRole(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });

      should(createStub).not.called();
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(securityController.createRole(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(createStub).not.called();
    });
  });

  describe('#getRole', () => {
    const getEvent = 'core:security:role:get';
    let getStub;

    beforeEach(() => {
      request.input.resource._id = 'test';
      getStub = kuzzle.ask.withArgs(getEvent, request.input.resource._id);
    });

    it('should resolve to an object on a getRole call', async () => {
      let returnedRole = new Role();
      returnedRole._id = 'foo';
      returnedRole._source = { bar: 'qux' };

      getStub.resolves(returnedRole);

      const response = await securityController.getRole(request);

      should(getStub).calledOnce();

      should(response).be.Object().and.not.instanceof(Role);
      should(response).match({
        _id: returnedRole._id,
        _source: returnedRole._source,
      });
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      getStub.rejects(error);

      return should(securityController.getRole(request)).be.rejectedWith(error);
    });

    it('should reject if no id is provided', async () => {
      request.input.resource._id = null;

      await should(securityController.getRole(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });

      should(getStub).not.called();
    });
  });

  describe('#mGetRoles', () => {
    const mGetEvent = 'core:security:role:mGet';
    let mGetStub;

    beforeEach(() => {
      request.input.body = { ids: 'foobar'.split('') };

      mGetStub = kuzzle.ask.withArgs(mGetEvent, sinon.match.array);
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(securityController.mGetRoles(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(mGetStub).not.called();
    });

    it('should reject if no ids is provided', async () => {
      delete request.input.body.ids;

      await should(securityController.mGetRoles(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });

      should(mGetStub).not.called();
    });

    it('should reject if ids is not an array', async () => {
      request.input.body.ids = 'foobar';

      await should(securityController.mGetRoles(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });

      should(mGetStub).not.called();
    });

    it('should forward a security module exception', () => {
      const error = new Error('foo');

      mGetStub.rejects(error);

      return should(securityController.mGetRoles(request)).rejectedWith(error);
    });

    it('should resolve to an object', async () => {
      const role1 = new Role();
      const role2 = new Role();
      const role3 = new Role();

      role1._id = 'role1';
      role2._id = 'role2';
      role3._id = 'role3';

      mGetStub.resolves([role1, role2, role3]);

      const response = securityController.mGetRoles(request);

      should(mGetStub).calledWithMatch(mGetEvent, request.input.body.ids);

      should(response).be.an.Object();
      should(response.hits).be.an.Array().and.have.length(3);

      for (let i = 0; i < response.hits.length; i++) {
        should(response.hits[i]).be.an.Object().and.not.instanceof(Role);
        should(response.hits[i]._id).eql(`role${i+1}`);
      }
    });
  });

  describe('#searchRoles', () => {
    const searchEvent = 'core:security:role:search';
    let searchStub;

    beforeEach(() => {
      request.input.body = { controllers: 'foobar'.split('') };

      searchStub = kuzzle.ask.withArgs(
        searchEvent,
        sinon.match.array,
        sinon.match.object);
    });

    it('should return response with an array of roles on searchRole call', async () => {
      const role = new Role();
      role._id = 'foo';
      role._source = {foo: 'bar'};

      searchStub.resolves({ hits: [role], total: 1 });

      const response = await securityController.searchRoles(request);

      should(response).be.an.Object();
      should(response.hits).be.an.Array().and.have.length(1);

      should(response.hits[0]).not.instanceof(Role).and.match({
        _id: role._id,
        _source: role._source,
      });

      should(searchStub).calledWithMatch(
        searchEvent,
        request.input.body.controllers,
        { from: 0, size: kuzzle.config.limits.documentsFetchCount });
    });

    it('should reject if the "size" option exceeds server limits', async () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;

      await should(securityController.searchRoles(request))
        .rejectedWith(SizeLimitError, {
          id: 'services.storage.get_limit_exceeded',
        });

      should(searchStub).not.called();
    });

    it('should reject if "controllers" is not an array', async () => {
      request.input.body.controllers = 'foo';

      await should(securityController.searchRoles(request))
        .rejectedWith(SizeLimitError, {
          id: 'api.assert.invalid_type',
        });

      should(searchStub).not.called();
    });

    it('should reject if "from" is invalid', async () => {
      for (const from of [true, false, {}, [], 'foo', 12.34]) {
        request.input.args.from = from;

        await should(securityController.searchRoles(request))
          .rejectedWith(SizeLimitError, {
            id: 'api.assert.invalid_type',
          });

        should(searchStub).not.called();
      }
    });

    it('should reject if "size" is invalid', async () => {
      for (const size of [true, false, {}, [], 'foo', 12.34]) {
        request.input.args.size = size;

        await should(securityController.searchRoles(request))
          .rejectedWith(SizeLimitError, {
            id: 'api.assert.invalid_type',
          });

        should(searchStub).not.called();
      }
    });

    it('should search for all controllers if none are provided', async () => {
      delete request.input.body.controllers;
      await securityController.searchRoles(request);
      should(searchStub).calledWithMatch(
        searchEvent,
        [],
        { from: 0, size: kuzzle.config.limits.documentsFetchCount });

      request.input.body = null;
      await securityController.searchRoles(request);
      should(searchStub).calledWithMatch(
        searchEvent,
        [],
        { from: 0, size: kuzzle.config.limits.documentsFetchCount });
    });

    it('should forward security module exceptions', () => {
      const error = new Error('foo');

      searchStub.rejects(error);

      return should(securityController.searchRoles(request)).rejectedWith(error);
    });
  });

  describe('#updateRole', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.role.load.resolves({_id: 'test'});
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = role => {
        if (role._id === 'alreadyExists') {
          return Bluebird.reject();
        }

        return Bluebird.resolve(role);
      };

      return securityController.updateRole(new Request({ _id: 'test', body: { foo: 'bar' } }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateRole(new Request({body: {}}));
      }).throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      kuzzle.repositories.role.load.resolves(null);
      return should(securityController.updateRole(new Request({_id: 'badId', body: {}, context: {action: 'updateRole'}}))).be.rejected();
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.role.load.resolves({_id: 'test'});
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = sinon.stub().returnsArg(0);

      return securityController.updateRole(new Request({
        _id: 'test',
        body: {
          foo: 'bar'
        },
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.role.validateAndSaveRole.firstCall.args[1];
          should(options).match({
            refresh: 'wait_for'
          });
        });
    });
  });

  describe('#deleteRole', () => {
    it('should return response with on deleteRole call', done => {
      const role = {_id: 'role'};

      kuzzle.repositories.role.load.resolves(role);
      kuzzle.repositories.role.delete.resolves();

      securityController.deleteRole(new Request({ _id: 'test', body: {} }))
        .then(() => {
          should(kuzzle.repositories.role.delete.calledWith(role)).be.true();
          done();
        });
    });

    it('should reject the promise if attempting to delete one of the core roles', () => {
      kuzzle.repositories.role.delete
        .rejects(new Error('admin is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.'));
      return should(securityController.deleteRole(new Request({_id: 'admin',body: {}}))).be.rejected();
    });

    it('should forward refresh option', () => {
      const role = {_id: 'role'};

      kuzzle.repositories.role.load.resolves(role);
      kuzzle.repositories.role.getRoleFromRequest.resolves(role);
      kuzzle.repositories.role.delete.resolves();

      return securityController.deleteRole(new Request({
        _id: 'test',
        body: {},
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.role.delete.firstCall.args[1];

          should(options).match({
            refresh: 'wait_for'
          });
        });
    });
  });

  describe('#mDeleteRoles', () => {
    it('should forward its args to mDelete', () => {
      securityController.mDelete = sinon.spy();
      securityController.mDeleteRoles(request);
      should(securityController.mDelete)
        .be.calledOnce()
        .be.calledWith('role', request);
    });
  });
});
