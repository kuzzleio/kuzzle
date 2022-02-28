'use strict';

const should = require('should');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const { BadRequestError } = require('../../..');

describe('BackendErrors', () => {
  let app;
  let Backend;

  beforeEach(() => {
    mockrequire('../../../lib/kuzzle', KuzzleMock);

    ({ Backend } = mockrequire.reRequire('../../../lib/core/backend/backend'));

    app = new Backend('black-mesa');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('BackendErrors#register', () => {
    it('should allows to register a standard error', () => {
      app.errors.register('api', 'wtf', {
        description: 'WTF',
        message: 'WTF bruh',
        class: 'BadRequestError',
      });
      app.errors.register('api', 'stfu', {
        description: 'STFU',
        message: 'STFU bro',
        class: 'BadRequestError',
      });

      const apiSubDomain = app.errors.domains.app.subdomains.api;
      should(apiSubDomain.code).be.eql(0);
      should(apiSubDomain.errors.wtf).match({
        description: 'WTF',
        message: 'WTF bruh',
        class: 'BadRequestError',
        code: 0,
      });
      should(apiSubDomain.errors.stfu.code).be.eql(1);
    });
  });

  describe('BackendErrors#get', () => {
    it('should get a standard error', () => {
      app.errors.register('api', 'wtf', {
        description: 'WTF',
        message: 'WTF bruh %s',
        class: 'BadRequestError',
      });

      const error = app.errors.get('api', 'wtf', 'custom');

      should(error).match({
        message: 'WTF bruh custom',
        id: 'app.api.wtf'
      });
      should(error).be.instanceOf(BadRequestError);
    });
  });
});
