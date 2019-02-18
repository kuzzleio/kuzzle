'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  FunnelProtocol = require('../../../../lib/api/core/sdk/funnelProtocol'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: sdk/funnelProtocol', () => {
  let
    kuzzle,
    request,
    funnelProtocol;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.funnel.executePluginRequest = sinon.stub().resolves('sdk result');

    kuzzle.repositories.token.verifyToken.resolves({ userId: 'admin' });
    kuzzle.repositories.user.load.resolves({ _id: 'admin' });

    request = {
      controller: 'foo',
      action: 'bar'
    };

    funnelProtocol = new FunnelProtocol(kuzzle);
  });

  describe('#isReady', () => {
    it('should return true', () => {
      should(funnelProtocol.isReady()).be.true();
    });
  });

  describe('#query', () => {
    it('should call executePluginRequest with the constructed request', () => {
      return funnelProtocol.query(request)
        .then(() => {
          should(kuzzle.funnel.executePluginRequest).be.calledOnce();

          const req = kuzzle.funnel.executePluginRequest.firstCall.args[0];
          should(req).be.an.instanceOf(Request);
          should(req.input.controller).be.equal('foo');
          should(req.input.action).be.equal('bar');
          should(req.context.user).be.null();

          should(kuzzle.repositories.token.verifyToken).be.calledOnce();
          should(kuzzle.repositories.user.load).be.calledOnce();
        });
    });

    it('should return the result in the good format', () => {
      return funnelProtocol.query(request)
        .then(res => {
          should(res.result).be.exactly('sdk result');
        });
    });

    it('should set the request user if its a contextualized request', () => {
      funnelProtocol.requestWithContext = true;

      return funnelProtocol.query(request)
        .then(() => {
          should(kuzzle.funnel.executePluginRequest).be.calledOnce();

          const req = kuzzle.funnel.executePluginRequest.firstCall.args[0];
          should(req).be.an.instanceOf(Request);
          should(req.context.user).not.be.null();
          should(req.context.user._id).be.equal('admin');

          should(funnelProtocol.requestWithContext).be.false();
        });
    });
  });
});
