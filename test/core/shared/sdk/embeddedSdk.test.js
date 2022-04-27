'use strict';

const should = require('should');
const sinon = require('sinon');
const mockrequire = require('mock-require');

const {
  PluginImplementationError,
} = require('../../../../index');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const { EmbeddedSDK } = require('../../../../lib/core/shared/sdk/embeddedSdk');

describe('EmbeddedSDK', () => {
  let embeddedSdk;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    embeddedSdk = new EmbeddedSDK();
  });

  describe('#as', () => {
    it('should return a new instance of an ImpersonatedSDK', () => {
      const SpyImpersonatedSdk = sinon.spy();
      mockrequire('../../../../lib/core/shared/sdk/impersonatedSdk', SpyImpersonatedSdk);
      const { EmbeddedSDK: MockEmbeddedSDK } = mockrequire.reRequire('../../../../lib/core/shared/sdk/embeddedSdk');

      try {
        const user = { _id: 'gordon' };
        embeddedSdk = new MockEmbeddedSDK();
        const returnedInstance = embeddedSdk.as(user);

        should(SpyImpersonatedSdk).be.calledWith(user._id);
        should(returnedInstance).be.instanceOf(SpyImpersonatedSdk);

        embeddedSdk.as(user, { checkRights: true });
        should(SpyImpersonatedSdk).be.calledWith(user._id, { checkRights: true });
      }
      finally {
        mockrequire.stopAll();
      }
    });

    it('should throw if the required user object is invalid', () => {
      should(() => embeddedSdk.as({ }))
        .throw(PluginImplementationError, { id: 'plugin.context.invalid_user' });
      should(() => embeddedSdk.as({ _id: 123 }))
        .throw(PluginImplementationError, { id: 'plugin.context.invalid_user' });
    });
  });

  describe('#query', () => {
    it('should add default propagate parameter', async () => {
      const request = { controller: 'realtime', action: 'subscribe' };
      embeddedSdk.protocol.query = sinon.stub().resolves({});

      await embeddedSdk.query(request);

      should(embeddedSdk.protocol.query)
        .be.calledWithMatch({ ...request, propagate: false });

      await embeddedSdk.query({ ...request }, { propagate: true });

      should(embeddedSdk.protocol.query)
        .be.calledWithMatch({ ...request, propagate: true });
    });

    it('should throw an error if the action is forbidden', () => {
      const forbiddenRequest = { controller: 'auth', action: 'createApiKey' };

      should(() => embeddedSdk.query(forbiddenRequest))
        .throw(PluginImplementationError, { id: 'forbidden_embedded_sdk_action', code: 14});
    });

    it('should warn if the action is not supported', () => {
      const warnRequest = { controller: 'auth', action: 'login' };

      embeddedSdk.query(warnRequest);

      should(kuzzle.log.warn)
        .be.calledOnce();
    });
  });
});
