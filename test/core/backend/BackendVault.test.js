'use strict';

const _ = require('lodash');
const should = require('should');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('Backend', () => {
  let application;
  let Backend;

  beforeEach(() => {
    mockrequire('../../../lib/kuzzle', KuzzleMock);

    ({ Backend } = mockrequire.reRequire('../../../lib/core/backend/backend'));

    application = new Backend('black-mesa');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('BackendVault#key', () => {
    it('should sets the vault key', () => {
      application.vault.key = 'unforeseen-consequences';

      should(application._vaultKey).be.eql('unforeseen-consequences');
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.key = 'unforeseen-consequences';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('BackendVault#file', () => {
    it('should sets the vault file', () => {
      application.vault.file = 'xen.bmp';

      should(application._secretsFile).be.eql('xen.bmp');
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.vault.file = 'xen.bmp';
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('BackendVault.secrets', () => {
    it('should exposes Kuzzle vault secrets when application is started', () => {
      application.started = true;
      _.set(application, '_kuzzle.vault.secrets', { beware: 'vortigaunt' });

      should(application.vault.secrets).be.eql({ beware: 'vortigaunt' });
    });
  });
});
