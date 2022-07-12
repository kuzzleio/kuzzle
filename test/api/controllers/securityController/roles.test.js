"use strict";

const should = require("should");
const sinon = require("sinon");

const {
  Request,
  BadRequestError,
  SizeLimitError,
} = require("../../../../index");
const KuzzleMock = require("../../../mocks/kuzzle.mock");

const SecurityController = require("../../../../lib/api/controllers/securityController");
const { Role } = require("../../../../lib/model/security/role");

describe("Test: security controller - roles", () => {
  let kuzzle;
  let request;
  let securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController();

    request = new Request({ controller: "security" }, { user: { _id: "4" } });
  });

  describe("#updateRoleMapping", () => {
    it("should throw a BadRequestError if the body is missing", async () => {
      await should(securityController.updateRoleMapping(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.body_required" }
      );

      should(
        kuzzle.ask.withArgs("core:storage:private:mappings:update")
      ).not.called();
    });

    it("should update the role mapping", async () => {
      request.input.body = { foo: "bar" };
      kuzzle.ask
        .withArgs("core:storage:private:mappings:update")
        .resolves(request.input.body);

      const response = await securityController.updateRoleMapping(request);

      should(kuzzle.ask).calledWith(
        "core:storage:private:mappings:update",
        kuzzle.internalIndex.index,
        "roles",
        request.input.body
      );

      should(response).match(request.input.body);
    });
  });

  describe("#getRoleMapping", () => {
    it("should fulfill with a response object", async () => {
      kuzzle.ask.withArgs("core:storage:private:mappings:get").resolves({
        properties: { foo: "bar" },
      });

      const response = await securityController.getRoleMapping(request);

      should(kuzzle.ask).be.calledWith(
        "core:storage:private:mappings:get",
        kuzzle.internalIndex.index,
        "roles"
      );

      should(response).match({ mapping: { foo: "bar" } });
    });
  });

  describe("#createOrReplaceRole", () => {
    const createOrReplaceEvent = "core:security:role:createOrReplace";
    let createOrReplaceStub;
    let createdRole;

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar" };

      createdRole = new Role();
      createdRole._id = request.input.args._id;
      Object.assign(createdRole, { controllers: { ctrl: true }, foo: "bar" });

      createOrReplaceStub = kuzzle.ask
        .withArgs(createOrReplaceEvent, request.input.args._id)
        .resolves(createdRole);
    });

    it("should create a role using default options", async () => {
      const response = await securityController.createOrReplaceRole(request);

      should(createOrReplaceStub).calledWithMatch(
        createOrReplaceEvent,
        request.input.args._id,
        request.input.body,
        {
          force: false,
          refresh: "wait_for",
          userId: request.context.user._id,
        }
      );

      should(response).be.an.Object().and.not.instanceof(Role);
      should(response).match({
        _id: createdRole._id,
        _source: {
          controllers: createdRole.controllers,
          foo: "bar",
        },
      });
    });

    it("should forward a security module exception", () => {
      const error = new Error("foo");

      createOrReplaceStub.rejects(error);

      return should(
        securityController.createOrReplaceRole(request)
      ).be.rejectedWith(error);
    });

    it("should forward request options", async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;

      await securityController.createOrReplaceRole(request);

      should(createOrReplaceStub).calledWithMatch(
        createOrReplaceEvent,
        request.input.args._id,
        request.input.body,
        {
          force: true,
          refresh: "false",
          userId: request.context.user._id,
        }
      );
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await should(
        securityController.createOrReplaceRole(request)
      ).rejectedWith(BadRequestError, { id: "api.assert.missing_argument" });

      should(createOrReplaceStub).not.called();
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await should(
        securityController.createOrReplaceRole(request)
      ).rejectedWith(BadRequestError, { id: "api.assert.body_required" });

      should(createOrReplaceStub).not.called();
    });
  });

  describe("#createRole", () => {
    const createEvent = "core:security:role:create";
    let createStub;
    let createdRole;

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar" };

      createdRole = new Role();
      createdRole._id = request.input.args._id;
      Object.assign(createdRole, { controllers: { ctrl: true }, foo: "bar" });

      createStub = kuzzle.ask
        .withArgs(createEvent, request.input.args._id)
        .resolves(createdRole);
    });

    it("should create a role using default options", async () => {
      const response = await securityController.createRole(request);

      should(createStub).calledWithMatch(
        createEvent,
        request.input.args._id,
        request.input.body,
        {
          force: false,
          refresh: "wait_for",
          userId: request.context.user._id,
        }
      );

      should(response).be.an.Object().and.not.instanceof(Role);
      should(response).match({
        _id: createdRole._id,
        _source: {
          controllers: createdRole.controllers,
          foo: "bar",
        },
      });
    });

    it("should forward a security module exception", () => {
      const error = new Error("foo");

      createStub.rejects(error);

      return should(securityController.createRole(request)).be.rejectedWith(
        error
      );
    });

    it("should forward request options", async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;

      await securityController.createRole(request);

      should(createStub).calledWithMatch(
        createEvent,
        request.input.args._id,
        request.input.body,
        {
          force: true,
          refresh: "false",
          userId: request.context.user._id,
        }
      );
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await should(securityController.createRole(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.missing_argument" }
      );

      should(createStub).not.called();
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await should(securityController.createRole(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.body_required" }
      );

      should(createStub).not.called();
    });
  });

  describe("#getRole", () => {
    const getEvent = "core:security:role:get";
    let getStub;

    beforeEach(() => {
      request.input.args._id = "test";
      getStub = kuzzle.ask.withArgs(getEvent, request.input.args._id);
    });

    it("should resolve to an object on a getRole call", async () => {
      let returnedRole = new Role();
      returnedRole._id = "foo";
      Object.assign(returnedRole, { controllers: { ctrl: true }, foo: "bar" });

      getStub.resolves(returnedRole);

      const response = await securityController.getRole(request);

      should(getStub).calledOnce();

      should(response).be.Object().and.not.instanceof(Role);
      should(response).match({
        _id: returnedRole._id,
        _source: {
          controllers: returnedRole.controllers,
          foo: "bar",
        },
      });
    });

    it("should forward a security module exception", () => {
      const error = new Error("foo");

      getStub.rejects(error);

      return should(securityController.getRole(request)).be.rejectedWith(error);
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await should(securityController.getRole(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.missing_argument" }
      );

      should(getStub).not.called();
    });
  });

  describe("#mGetRoles", () => {
    const mGetEvent = "core:security:role:mGet";
    let mGetStub;

    beforeEach(() => {
      request.input.body = { ids: "foobar".split("") };

      mGetStub = kuzzle.ask.withArgs(mGetEvent);
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await should(securityController.mGetRoles(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.body_required" }
      );

      should(mGetStub).not.called();
    });

    it("should reject if no ids is provided", async () => {
      delete request.input.body.ids;

      await should(securityController.mGetRoles(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.missing_argument" }
      );

      should(mGetStub).not.called();
    });

    it("should reject if ids is not an array", async () => {
      request.input.body.ids = "foobar";

      await should(securityController.mGetRoles(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.invalid_type" }
      );

      should(mGetStub).not.called();
    });

    it("should forward a security module exception", () => {
      const error = new Error("foo");

      mGetStub.rejects(error);

      return should(securityController.mGetRoles(request)).rejectedWith(error);
    });

    it("should resolve to an object", async () => {
      const role1 = new Role();
      const role2 = new Role();
      const role3 = new Role();

      role1._id = "role1";
      role2._id = "role2";
      role3._id = "role3";

      mGetStub.resolves([role1, role2, role3]);

      const response = await securityController.mGetRoles(request);

      should(mGetStub).calledWithMatch(mGetEvent, request.input.body.ids);

      should(response).be.an.Object();
      should(response.hits).be.an.Array().and.have.length(3);

      for (let i = 0; i < response.hits.length; i++) {
        should(response.hits[i]).be.an.Object().and.not.instanceof(Role);
        should(response.hits[i]._id).eql(`role${i + 1}`);
      }
    });
  });

  describe("#searchRoles", () => {
    const searchEvent = "core:security:role:search";
    let searchStub;
    let searchedRole;

    beforeEach(() => {
      request.input.body = { controllers: "foobar".split("") };

      searchedRole = new Role();
      searchedRole._id = "foo";
      Object.assign(searchedRole, { controllers: { ctrl: true }, foo: "bar" });

      searchStub = kuzzle.ask
        .withArgs(searchEvent)
        .resolves({ hits: [searchedRole], total: 1 });
    });

    it("should return response with an array of roles on searchRole call", async () => {
      const response = await securityController.searchRoles(request);

      should(response).be.an.Object();
      should(response.hits).be.an.Array().and.have.length(1);

      should(response.hits[0])
        .not.instanceof(Role)
        .and.match({
          _id: searchedRole._id,
          _source: {
            controllers: searchedRole.controllers,
            foo: "bar",
          },
        });

      should(searchStub).calledWithMatch(
        searchEvent,
        { controllers: request.input.body.controllers },
        { from: 0, size: kuzzle.config.limits.documentsFetchCount }
      );
    });

    it('should reject if the "size" option exceeds server limits', async () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;

      await should(securityController.searchRoles(request)).rejectedWith(
        SizeLimitError,
        {
          id: "services.storage.get_limit_exceeded",
        }
      );

      should(searchStub).not.called();
    });

    it('should reject if "controllers" is not an array', async () => {
      request.input.body.controllers = "foo";

      await should(securityController.searchRoles(request)).rejectedWith(
        BadRequestError,
        {
          id: "api.assert.invalid_type",
        }
      );

      should(searchStub).not.called();
    });

    it('should reject if "from" is invalid', async () => {
      for (const from of [true, false, {}, [], "foo", 12.34]) {
        request.input.args.from = from;

        await should(securityController.searchRoles(request)).rejectedWith(
          BadRequestError,
          {
            id: "api.assert.invalid_type",
          }
        );

        should(searchStub).not.called();
      }
    });

    it('should reject if "size" is invalid', async () => {
      for (const size of [true, false, {}, [], "foo", 12.34]) {
        request.input.args.size = size;

        await should(securityController.searchRoles(request)).rejectedWith(
          BadRequestError,
          {
            id: "api.assert.invalid_type",
          }
        );

        should(searchStub).not.called();
      }
    });

    it("should search for all controllers if none are provided", async () => {
      delete request.input.body.controllers;

      await securityController.searchRoles(request);

      should(searchStub).calledWithMatch(
        searchEvent,
        {},
        { from: 0, size: kuzzle.config.limits.documentsFetchCount }
      );

      request.input.body = null;

      await securityController.searchRoles(request);

      should(searchStub).calledWithMatch(
        searchEvent,
        {},
        { from: 0, size: kuzzle.config.limits.documentsFetchCount }
      );
    });

    it("should forward security module exceptions", () => {
      const error = new Error("foo");

      searchStub.rejects(error);

      return should(securityController.searchRoles(request)).rejectedWith(
        error
      );
    });
  });

  describe("#updateRole", () => {
    const updateEvent = "core:security:role:update";
    let updateStub;
    let updatedRole;

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar" };

      updatedRole = new Role();
      updatedRole._id = "test";
      Object.assign(updatedRole, { controllers: { ctrl: true }, foo: "bar" });

      updateStub = kuzzle.ask.withArgs(updateEvent).resolves(updatedRole);
    });

    it("should return a valid response and use default options", async () => {
      const response = await securityController.updateRole(request);

      should(updateStub).calledWithMatch(
        updateEvent,
        request.input.args._id,
        request.input.body,
        {
          force: false,
          refresh: "wait_for",
          retryOnConflict: 10,
          userId: request.context.user._id,
        }
      );

      should(response).be.an.Object().and.not.instanceof(Role);
      should(response).match({
        _id: updatedRole._id,
        _source: {
          controllers: updatedRole.controllers,
          foo: "bar",
        },
      });
    });

    it("should reject if no id is given", async () => {
      request.input.args._id = null;

      await should(securityController.updateRole(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.missing_argument" }
      );

      should(updateStub).not.called();
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await should(securityController.updateRole(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.body_required" }
      );

      should(updateStub).not.called();
    });

    it("should forward an exception thrown by the security module", () => {
      const error = new Error("foo");

      updateStub.rejects(error);

      return should(securityController.updateRole(request)).rejectedWith(error);
    });

    it("should forward request options", async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;
      request.input.args.retryOnConflict = 123;

      await securityController.updateRole(request);

      should(updateStub).calledWithMatch(
        updateEvent,
        request.input.args._id,
        request.input.body,
        {
          force: true,
          refresh: "false",
          retryOnConflict: 123,
          userId: request.context.user._id,
        }
      );
    });
  });

  describe("#deleteRole", () => {
    const deleteEvent = "core:security:role:delete";
    let deleteStub;

    beforeEach(() => {
      request.input.args._id = "test";

      deleteStub = kuzzle.ask.withArgs(deleteEvent);
    });

    it("should return a valid response and handle default options", async () => {
      const response = await securityController.deleteRole(request);

      should(deleteStub).calledWithMatch(deleteEvent, request.input.args._id, {
        refresh: "wait_for",
      });

      should(response).match({ _id: request.input.args._id });
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await should(securityController.deleteRole(request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.missing_argument" }
      );

      should(deleteStub).not.called();
    });

    it("should forward request options", async () => {
      request.input.args.refresh = false;

      await securityController.deleteRole(request);

      should(deleteStub).calledWithMatch(deleteEvent, request.input.args._id, {
        refresh: "false",
      });
    });
  });

  describe("#mDeleteRoles", () => {
    it("should forward to _mDelete and return its response", async () => {
      sinon.stub(securityController, "_mDelete");
      securityController._mDelete.resolves("foobar");

      const response = await securityController.mDeleteRoles(request);

      should(securityController._mDelete).calledWith("role", request);
      should(response).eql("foobar");
    });
  });
});
