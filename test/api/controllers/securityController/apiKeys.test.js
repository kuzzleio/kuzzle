"use strict";

const sinon = require("sinon");
const should = require("should");

const KuzzleMock = require("../../../mocks/kuzzle.mock");
const SecurityController = require("../../../../lib/api/controllers/securityController");
const { Request } = require("../../../../index");
const ApiKey = require("../../../../lib/model/storage/apiKey");
const { sha256 } = require("../../../../lib/util/crypto");
const kerror = require("../../../../lib/kerror");

describe("/api/controllers/securityController/deleteApiKey", () => {
  let request;
  let securityController;
  let apiKey;

  beforeEach(() => {
    new KuzzleMock();
    securityController = new SecurityController.default();
    request = new Request({
      controller: "security",
      action: "deleteApiKey",
      userId: "mylehuong",
    });

    apiKey = { _id: "api-key-id", delete: sinon.stub().resolves() };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should delete the API key identified by its _id", async () => {
    request.input.args._id = "api-key-id";
    const loadStub = sinon.stub(ApiKey, "load").resolves(apiKey);

    const response = await securityController.deleteApiKey(request);

    should(loadStub).be.calledWith("mylehuong", "api-key-id");
    should(apiKey.delete).be.calledWith({ refresh: "wait_for" });
    should(response).be.eql({ _id: "api-key-id" });
  });

  it("should delete the API key identified by its fingerprint", async () => {
    request.input.args.fingerprint = "the-fingerprint";
    const loadStub = sinon.stub(ApiKey, "loadByFingerprint").resolves(apiKey);

    const response = await securityController.deleteApiKey(request);

    should(loadStub).be.calledWith("mylehuong", "the-fingerprint");
    should(apiKey.delete).be.calledWith({ refresh: "wait_for" });
    should(response).be.eql({ _id: "api-key-id" });
  });

  it("should delete the API key identified by its clear-text key", async () => {
    request.input.args.key = "the-clear-text-key";
    const loadStub = sinon.stub(ApiKey, "loadByFingerprint").resolves(apiKey);

    const response = await securityController.deleteApiKey(request);

    should(loadStub).be.calledWith("mylehuong", sha256("the-clear-text-key"));
    should(apiKey.delete).be.calledWith({ refresh: "wait_for" });
    should(response).be.eql({ _id: "api-key-id" });
  });

  it("should give precedence to _id over key and fingerprint", async () => {
    request.input.args._id = "api-key-id";
    request.input.args.key = "the-clear-text-key";
    request.input.args.fingerprint = "the-fingerprint";
    const loadStub = sinon.stub(ApiKey, "load").resolves(apiKey);
    const loadByFingerprintStub = sinon
      .stub(ApiKey, "loadByFingerprint")
      .resolves(apiKey);

    await securityController.deleteApiKey(request);

    should(loadStub).be.calledWith("mylehuong", "api-key-id");
    should(loadByFingerprintStub).not.be.called();
  });

  it("should give precedence to key over fingerprint", async () => {
    request.input.args.key = "the-clear-text-key";
    request.input.args.fingerprint = "the-fingerprint";
    const loadByFingerprintStub = sinon
      .stub(ApiKey, "loadByFingerprint")
      .resolves(apiKey);

    await securityController.deleteApiKey(request);

    should(loadByFingerprintStub).be.calledWith(
      "mylehuong",
      sha256("the-clear-text-key"),
    );
  });

  it("should reject if none of _id, key or fingerprint is provided", async () => {
    const loadStub = sinon.stub(ApiKey, "load").resolves(apiKey);
    const loadByFingerprintStub = sinon
      .stub(ApiKey, "loadByFingerprint")
      .resolves(apiKey);

    await should(securityController.deleteApiKey(request)).be.rejectedWith({
      id: "api.assert.missing_argument",
    });

    should(loadStub).not.be.called();
    should(loadByFingerprintStub).not.be.called();
  });

  it("should forward the refresh option", async () => {
    request.input.args._id = "api-key-id";
    request.input.args.refresh = "wait_for";
    sinon.stub(ApiKey, "load").resolves(apiKey);

    await securityController.deleteApiKey(request);

    should(apiKey.delete).be.calledWith({ refresh: "wait_for" });
  });

  it("should propagate a not_found error if the API key does not exist", async () => {
    request.input.args.fingerprint = "unknown-fingerprint";
    sinon
      .stub(ApiKey, "loadByFingerprint")
      .rejects(
        kerror.get("services", "storage", "not_found", "unknown-fingerprint"),
      );

    await should(securityController.deleteApiKey(request)).be.rejectedWith({
      id: "services.storage.not_found",
    });
  });
});
