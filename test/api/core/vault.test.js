const
  path = require('path'),
  should = require('should'),
  sinon = require('sinon'),
  mockRequire = require('mock-require');

describe('Test: vault core component', () => {
  let
    fsMock,
    clearSecrets,
    encryptedSecrets,
    encryptedSecretsIv8,
    Vault,
    assertStub,
    vault;

  beforeEach(() => {
    clearSecrets = {
      aws: {
        keyId: 'key id',
        secretKey: 'very long key 1234567890 1234567890 1234567890'
      },
      deep: { nested: { value: 'nested value' } }
    };

    encryptedSecrets = {
      aws: {
        keyId: 'ac2560ec6b05098a843cdc5ab106bf99.f79775f7fd8fb7c8f456b68741414fcc',
        secretKey: '818b89d7f2c765c1ec2e32813c3b3d009aa32c5fd82765f43fd3a71e2c71d542fd6f236057dcfe88b5692034aba7992f.96c14905dfbe90aa4de931869d63846a'
      },
      deep: {
        nested: {
          value: '2d6e38affac8af21f74aeddd46c8b612.1722fd113c38784d4d177039d7eac48e'
        }
      }
    };

    // Encrypted secrets with 8 bytes IV
    encryptedSecretsIv8 = {
      aws: {
        keyId: '5f71b9bc33a6aea5b0263c9be88c1c4f.786ff771e2760258',
        secretKey: 'f34bc1a69c2df404bf8a7856f0071232525ebc03c4ecb47ad61aedac3519b358a3b37523a7833d3575f9bff17437d7f6.6500cbdee07dc057'
      },
      deep: {
        nested: {
          value: 'dec91b4587ae9eacdee8d7ba309e0f3f.d46c598fcbe46d9c'
        }
      }
    };

    process.env.KUZZLE_VAULT_KEY = 'the spoon does not exists';

    fsMock = {
      existsSync: sinon.stub().returns(true),
      readFile: sinon.stub().yields(null, JSON.stringify(encryptedSecrets))
    };

    assertStub = sinon.spy((...args) => {
      const [ assertion, message ] = args;

      if (Boolean(assertion) === false) {
        throw new Error(message);
      }
    });

    mockRequire('fs', fsMock);
    mockRequire('assert', assertStub);
    Vault = mockRequire.reRequire('../../../lib/api/core/vault');

    vault = new Vault();
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  describe('#init', () => {
    beforeEach(() => {
      vault.defaultSecretsFile = 'config/secrets.enc.json';
      vault.vaultKey = 'the spoon does not exists';
    });

    it('does nothing if vaultKey and secret file are not present', () => {
      delete vault.vaultKey;
      fsMock.existsSync.returns(false);

      return vault.init()
        .then(() => {
          should(vault.encryptedSecretsFile).be.eql(path.resolve('config/secrets.enc.json'));
          should(vault.vaultKeyHash).be.undefined();
          should(vault.secrets).match({});
        });
    });

    it('rejects if vaultKey is not present and the secret file is present', () => {
      delete vault.vaultKey;

      should(() => {
        vault.init();
      }).throw();

      should(assertStub)
        .be.calledOnce()
        .be.calledWith(false, 'A secrets file is present and no vault key can be found. Aborting.');
    });

    it('rejects if vaultKey is present and the secret file is not present', () => {
      fsMock.existsSync.returns(false);

      should(() => {
        vault.init();
      }).throw();

      should(assertStub)
        .be.calledTwice()
        .be.calledWith(false, 'A vault key is present and no secrets file can be found. Aborting.');
    });

    it('rejects if secrets is not an object', () => {
      should(() => {
        vault.encryptObject('not an object');
      }).throw();    });

    it('reads the secret file and store decrypted secrets', () => {
      vault.prepareCrypto();

      return vault.init()
        .then(() => {
          should(vault.encryptedSecretsFile).not.be.undefined();
          should(vault.vaultKeyHash).not.be.undefined();
          should(vault.secrets).match(clearSecrets);
        });
    });

    it('reads the secret file and store decrypted secrets with old IV size of 8 bytes', () => {
      fsMock.readFile.yields(null, JSON.stringify(encryptedSecretsIv8));
      vault.prepareCrypto();

      return vault.init()
        .then(() => {
          should(vault.encryptedSecretsFile).not.be.undefined();
          should(vault.vaultKeyHash).not.be.undefined();
          should(vault.secrets).match(clearSecrets);
        });
    });
  });

  describe('#prepareCrypto', () => {
    it('takes the key in parameter if specified', () => {
      vault.prepareCrypto('i am the key');

      should(vault.vaultKey).be.eql('i am the key');
      should(vault.vaultKeyHash).not.be.undefined();
    });

    it('takes KUZZLE_VAULT_KEY environment variable is vaultKey is not specified', () => {
      vault.prepareCrypto();

      should(vault.vaultKey).be.eql('the spoon does not exists');
      should(vault.vaultKeyHash).not.be.undefined();
    });
  });
});
