'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  FunnelProtocol = require('../../../../lib/api/core/sdk/funnelProtocol');

describe('Test: sdk/funnelProtocol', () => {
  let
    request,
    funnel,
    funnelProtocol;

  beforeEach(() => {
    funnel = {};

    funnel.executePluginRequest = sinon.stub().resolves('sdk result');

    request = {
      controller: 'foo',
      action: 'bar'
    };

    funnelProtocol = new FunnelProtocol(funnel);
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
          should(funnel.executePluginRequest).be.calledOnce();

          const req = funnel.executePluginRequest.firstCall.args[0];
          should(req).be.an.instanceOf(Request);
          should(req.input.controller).be.equal('foo');
          should(req.input.action).be.equal('bar');
        });
    });

    it('should return the result in the good format', () => {
      return funnelProtocol.query(request)
        .then(res => {
          should(res.result).be.exactly('sdk result');
        });
    });

    it('should set the request user if the protocol is instantiated with a request', () => {
      const originalRequest = { context: { user: { _id: 'gordon' } } };

      funnelProtocol = new FunnelProtocol(funnel, originalRequest);

      return funnelProtocol.query(request)
        .then(() => {
          should(funnel.executePluginRequest).be.calledOnce();

          const req = funnel.executePluginRequest.firstCall.args[0];
          should(req).be.an.instanceOf(Request);
          should(req.context.user).not.be.null();
          should(req.context.user._id).be.equal('gordon');
        });
    });
  });
});
