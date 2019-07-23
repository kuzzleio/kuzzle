'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  {
    Request,
    errors: {
      InternalError
    }
  } = require('kuzzle-common-objects'),
  User = require('../../../../lib/api/core/models/security/user'),
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

  describe('#constructor', () => {
    it('should throw an InternalError if the funnel is instantiated without a valid User object', () => {
      should(() => {
        new FunnelProtocol(funnel, { _id: 'gordon' });
      }).throw(InternalError);
    });
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
          should(req.context.connection.protocol).be.equal('funnel');
        });
    });

    it('should return the result in the good format', () => {
      return funnelProtocol.query(request)
        .then(res => {
          should(res.result).be.exactly('sdk result');
        });
    });

    it('should execute the request with the provided User if present', () => {
      funnel.executePluginRequest.resolvesArg(0);
      const user = new User();
      user._id = 'gordon';

      funnelProtocol = new FunnelProtocol(funnel, user);

      return funnelProtocol.query(request)
        .then(response => {
          should(response.result.context.user).be.eql(user);
        });
    });

    it('should reject if trying to call the realtime controller', () => {
      return should(funnelProtocol.query({
        controller: 'realtime',
        action: 'subscribe'
      }))
        .be.rejectedWith(/realtime.subscribe method is not available in plugins\. You should use plugin hooks instead/);
    });
  });
});
