"use strict";

const sinon = require("sinon");
const should = require("should");
const rewire = require("rewire");

const Vault = rewire("../../lib/kuzzle/vault");

describe("/lib/kuzzle/vault", () => {
  it("should call vault with params from the CLI", () => {
    let vaultArgs;

    Vault.__with__({
      fs: {
        existsSync: sinon.stub().returns(true),
      },
    })(async () => {
      const vault = new Vault(
        "the spoon does not exist",
        "config/secrets.json"
      );

      should(vaultArgs).eql(["the spoon does not exist"]);
      should(vault._vaultKey).be.exactly("the spoon does not exists");
      should(vault._encryptedSecretsFile).be.exactly("config/secrets.json");
    });
  });
});
