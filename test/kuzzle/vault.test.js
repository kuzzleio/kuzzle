"use strict";

const fs = require("fs");

const should = require("should");
const sinon = require("sinon");

const vaultPath = require.resolve("../../lib/kuzzle/vault");

let vault;

/**
 * `load()` memoises the vault key in module state, on purpose: kuzzle-vault
 * deletes KUZZLE_VAULT_KEY from the environment after reading it, and Kaaf
 * instantiates the vault twice. A fresh copy per test keeps that state from
 * leaking into the next one — and lets one test drive it deliberately.
 */
function freshVault() {
  delete require.cache[vaultPath];

  return require(vaultPath);
}

/** The error `load()` threw, or `undefined`. */
function loadError(...args) {
  try {
    vault.load(...args);
  } catch (error) {
    return error;
  }

  return undefined;
}

describe("/lib/kuzzle/vault", () => {
  let existsSync;

  beforeEach(() => {
    existsSync = sinon.stub(fs, "existsSync");

    delete process.env.KUZZLE_VAULT_KEY;
    delete process.env.KUZZLE_SECRETS_FILE;

    vault = freshVault();
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

    const error = loadError();

    // `should(...).throw()` with no matcher was the old assertion, and it held
    // whether or not the environment was read: with no key, load() throws the
    // missing-key assertion instead. What proves the key was read is *which*
    // error comes back — decryption was attempted, so it is not that one
    // (TD-57, #2760).
    should(error).be.an.Error();
    should(error.message).not.startWith(
      "A secret file has been provided but Kuzzle cannot find the Vault key",
    );
  });

  it("should remember the vault key once the environment has been cleared", () => {
    existsSync.returns(true);
    process.env.KUZZLE_VAULT_KEY = "secret key";

    loadError();

    // What kuzzle-vault does to the environment after reading it, and the whole
    // reason the module keeps the key: Kaaf loads the vault twice, once before
    // init and once after.
    delete process.env.KUZZLE_VAULT_KEY;

    const error = loadError();

    should(error).be.an.Error();
    should(error.message).not.startWith(
      "A secret file has been provided but Kuzzle cannot find the Vault key",
    );
  });

  it("should not carry a remembered key into a fresh process", () => {
    existsSync.returns(true);
    process.env.KUZZLE_VAULT_KEY = "secret key";

    loadError();

    delete process.env.KUZZLE_VAULT_KEY;
    vault = freshVault();

    should(loadError().message).startWith(
      "A secret file has been provided but Kuzzle cannot find the Vault key",
    );
  });
});
