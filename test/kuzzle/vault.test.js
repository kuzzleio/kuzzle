"use strict";

const sinon = require("sinon");
const should = require("should");
const rewire = require("rewire");

const vault = rewire("../../lib/kuzzle/vault");

describe("/lib/kuzzle/vault", () => {
  let VaultStub;
  let restoreFs;
  let restoreVault;

  beforeEach(() => {
    VaultStub = sinon.stub().returns({ decrypt: sinon.stub() });

    restoreFs = vault.__set__("fs", {
      existsSync: sinon.stub().returns(true),
    });
    restoreVault = vault.__set__("Vault", VaultStub);
  });

  afterEach(() => {
    restoreFs();
    restoreVault();
  });

  it("should use the legacy AES-256-CBC cipher by default", () => {
    vault.load("the spoon does not exist", "config/secrets.enc.json");

    should(VaultStub).be.calledWith("the spoon does not exist", {
      cipher: "aes-256-cbc",
    });
  });

  it("should use the legacy AES-256-CBC cipher when the new algorithm is not opted in", () => {
    vault.load("the spoon does not exist", "config/secrets.enc.json", false);

    should(VaultStub).be.calledWith("the spoon does not exist", {
      cipher: "aes-256-cbc",
    });
  });

  it("should use the AES-256-GCM cipher when the new algorithm is opted in", () => {
    vault.load("the spoon does not exist", "config/secrets.enc.json", true);

    should(VaultStub).be.calledWith("the spoon does not exist", {
      cipher: "aes-256-gcm",
    });
  });
});
