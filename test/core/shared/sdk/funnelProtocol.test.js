'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const {
  Request,
  PluginImplementationError
} = require('../../../../index');
const User = require('../../../../lib/model/security/user');
const FunnelProtocol = require('../../../../lib/core/shared/sdk/funnelProtocol');

describe('Test: sdk/funnelProtocol', () => {
  let request;
  let kuzzle;
  let funnelProtocol;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.funnel.executePluginRequest = sinon.stub().resolves('sdk result');

    request = {
      controller: 'foo',
      action: 'bar'
    };

    funnelProtocol = new FunnelProtocol();
  });

  describe('#constructor', () => {
    it('should throw if the funnel is instantiated without a valid User object', () => {
      should(() => {
        new FunnelProtocol({ id: 42 });
      }).throw(PluginImplementationError, { id: 'plugin.context.invalid_user' });
    });

    it('should forward messages received from the internalProtocol to the SDK', done => {
      const payload = { room: 'room-id', hello: 'Gordon' };

      funnelProtocol.on('room-id', () => {
        try {
          should(kuzzle.on).be.calledOnce();
          should(kuzzle.on.getCall(0).args[0])
            .be.eql('core:network:internal:message');

          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.emit('core:network:internal:message', payload);
    });
  });

  describe('#isReady', () => {
    it('should return true', () => {
      should(funnelProtocol.isReady()).be.true();
    });
  });

  describe('#query', () => {
    beforeEach(() => {
      kuzzle.ask
        .withArgs('core:network:internal:connectionId:get')
        .resolves('connection-id');
    });

    it('should call executePluginRequest with the constructed request', () => {
      return funnelProtocol.query(request)
        .then(() => {
          should(kuzzle.funnel.executePluginRequest).be.calledOnce();

          const req = kuzzle.funnel.executePluginRequest.firstCall.args[0];
          should(req).be.an.instanceOf(Request);
          should(req.input.controller).be.equal('foo');
          should(req.input.action).be.equal('bar');
          should(req.context.connection.protocol).be.equal('funnel');
          should(req.context.connection.id).be.eql('connection-id');
        });
    });

    it('should return the result in the good format', () => {
      return funnelProtocol.query(request)
        .then(res => {
          should(res.result).be.exactly('sdk result');
        });
    });

    it('should execute the request with the provided User if present', () => {
      kuzzle.funnel.executePluginRequest.resolvesArg(0);
      const user = new User();
      user._id = 'gordon';

      funnelProtocol = new FunnelProtocol(user);

      return funnelProtocol.query(request)
        .then(response => {
          should(response.result.context.user).be.eql(user);
        });
    });
  });
});
