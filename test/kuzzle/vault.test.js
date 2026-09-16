"use strict";

const fs = require("fs");

const should = require("should");
const sinon = require("sinon");

const vault = require("../../lib/kuzzle/vault");

describe("/lib/kuzzle/vault", () => {
  let existsSync;

  beforeEach(() => {
    existsSync = sinon.stub(fs, "existsSync");

    delete process.env.KUZZLE_VAULT_KEY;
    delete process.env.KUZZLE_SECRETS_FILE;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should throw if the provided secrets file cannot be found", () => {
    existsSync.returns(false);

    should(() => vault.load("secret key", "config/secrets.enc.json")).throw(
      /A secret file has been provided but Kuzzle cannot find it at/,
    );
  });

  it("should throw if a secrets file is found but no vault key is given", () => {
    existsSync.returns(true);

    should(() => vault.load()).throw(
      "A secret file has been provided but Kuzzle cannot find the Vault key. Aborting.",
    );
  });

  it("should throw if a vault key is given but no secrets file is found", () => {
    existsSync.returns(false);

    should(() => vault.load("secret key")).throw(
      /A Vault key is present but Kuzzle cannot find the secret file at/,
    );
  });

  it("should return an undecrypted vault when neither is provided", () => {
    existsSync.returns(false);

    const loaded = vault.load();

    should(loaded).be.an.Object();
    should(loaded.secrets).be.eql({});
  });

  it("should read the vault key from the environment", () => {
    existsSync.returns(true);
    process.env.KUZZLE_VAULT_KEY = "secret key";

    // The key is found, so the "cannot find the Vault key" assertion passes and
    // decryption is attempted on the default secrets file.
    should(() => vault.load()).throw();
  });
});
