'use strict';

const should = require('should');
const sinon = require('sinon');

const { EmbeddedSDK } = require('../../../../lib/core/shared/sdk/embeddedSdk');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('EmbeddedSDK', () => {
  let embeddedSdk;

  beforeEach(() => {
    new KuzzleMock();
    embeddedSdk = new EmbeddedSDK();
  });

  describe('#as', () => {
    it('should instantiate the SDK with the user', () => {
      const user = { _id: 'gordon' };

      const impersonatedSdk = embeddedSdk.as(user);

      should(impersonatedSdk.protocol.user).be.eql(user);
    });
  });

  describe('#query', () => {
    it('should add default propagate parameter', async () => {
      const request = { controller: 'realtime', action: 'subscribe' };
      embeddedSdk.protocol.query = sinon.stub().resolves();

      await embeddedSdk.query(request);

      should(embeddedSdk.protocol.query)
        .be.calledWith({ ...request, propagate: false });

      await embeddedSdk.query({ ...request }, { propagate: true });

      should(embeddedSdk.protocol.query)
        .be.calledWith({ ...request, propagate: true });
    });
  });
});
