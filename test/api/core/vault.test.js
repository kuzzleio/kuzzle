const
  should = require('should'),
  sinon = require('sinon'),
  mockRequire = require('mock-require');

describe('Test: vault core component', () => {
  let
    fsMock,
    clearSecrets,
    encryptedSecrets,
    Vault,
    assertStub,
    vault;

  beforeEach(() => {
    clearSecrets = {
      aws: {
        keyId: 'key id',
        secretKey: 'secret key'
      },
      deep: { nested: { value: 'nested value' } }
    };

    encryptedSecrets = {
      aws: {
        keyId: 'a47de7426fbcb8904290e376f147bc73.8e4b35be62ecbc53',
        secretKey: '595b8ef58496a3bc472c457cc3ed3a04.62fe750c9570af14'
      },
      deep: { nested: { value: '2900758dc274c9892f42327c8435e1f0.57cb3aeee1c31f49' } }
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
      vault.vaultKey = 'the spoon does not exists';
    });

    it('does nothing if vaultKey and secret file are not present', () => {
      delete vault.vaultKey;
      fsMock.existsSync.returns(false);

      return vault.init()
        .then(() => {
          should(vault.encryptedSecretsFile).be.eql('../../../config/secrets.enc.json');
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

    it('reads the secret file and store decrypted secrets', () => {
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
