const
  should = require('should'),
  sinon = require('sinon'),
  mockRequire = require('mock-require');

describe('Test: vault core component', () => {
  let
    fsMock,
    config,
    clearSecrets,
    encryptedSecrets,
    Vault,
    vault;

  beforeEach(() => {
    config = {
      server: {
        vaultSeed: 'the cake is a lie'
      }
    };

    clearSecrets = {
      aws: {
        keyId: 'key id',
        secretKey: 'secret key'
      },
      deep: { nested: { value: 'nested value' } }
    };

    encryptedSecrets = {
      aws: {
        keyId: '5a93f3f45f286b93299f6646c72e3003',
        secretKey: '1d7b2fa9820b8a14a2c457f4a71d06c3'
      },
      deep: { nested: { value: 'fa78a612dad25afa3c432d572be82895' } }
    };

    process.env.KUZZLE_VAULT_KEY = 'the spoon does not exists';

    fsMock = {
      existsSync: sinon.stub().returns(true),
      readFile: sinon.stub().yields(null, JSON.stringify(encryptedSecrets))
    };

    mockRequire('fs', fsMock);
    Vault = mockRequire.reRequire('../../../lib/api/core/vault');

    vault = new Vault(config);
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  describe('#init', () => {
    it('does nothing if vaultKey and secret file are not present', () => {
      fsMock.existsSync.returns(false);

      return vault.init()
        .then(() => {
          should(vault.encryptedSecretsFile).be.eql('../../../config/secrets.enc.json');
          should(vault.vaultKeyHash).be.undefined();
          should(vault.cipherIV).be.undefined();
          should(vault.secrets).match({});
        });
    });

    it('rejects if vaultKey is not present and the secret file is present', () => {
      return should(vault.init()).be.rejected();
    });

    it('rejects if vaultKey is present and the secret file is not present', () => {
      return should(vault.init()).be.rejected();
    });

    it('reads the secret file and store decrypted secrets', () => {
      vault.prepareCrypto();

      return vault.init()
        .then(() => {
          should(vault.encryptedSecretsFile).not.be.undefined();
          should(vault.vaultKeyHash).not.be.undefined();
          should(vault.cipherIV).be.eql('the cake is a li');
          should(vault.secrets).match(clearSecrets);
        });
    });
  });

  describe('#prepareCrypto', () => {
    it('takes the key in parameter if specified', () => {
      vault.prepareCrypto('i am the key');

      should(vault.vaultKey).be.eql('i am the key');
      should(vault.vaultKeyHash).not.be.undefined();
      should(vault.cipherIV).be.eql('the cake is a li');
    });

    it('takes KUZZLE_VAULT_KEY environment variable is vaultKey is not specified', () => {
      vault.prepareCrypto();

      should(vault.vaultKey).be.eql('the spoon does not exists');
      should(vault.vaultKeyHash).not.be.undefined();
      should(vault.cipherIV).be.eql('the cake is a li');
    });
  });
});
