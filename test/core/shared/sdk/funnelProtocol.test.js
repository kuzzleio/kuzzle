'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const {
  Request,
  PluginImplementationError,
  ForbiddenError
} = require('../../../../index');
const { User } = require('../../../../lib/model/security/user');
const FunnelProtocol = require('../../../../lib/core/shared/sdk/funnelProtocol');

describe('Test: sdk/funnelProtocol', () => {
  let request;
  let kuzzle;
  let funnelProtocol;
  let exampleUser;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.funnel.executePluginRequest = sinon.stub().resolves('sdk result');

    request = {
      controller: 'foo',
      action: 'bar'
    };

    funnelProtocol = new FunnelProtocol();

    exampleUser = new User();
    exampleUser._id = 'gordon';
  });

  describe('#constructor', () => {
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
      kuzzle.ask
        .withArgs('core:security:user:get', exampleUser._id)
        .resolves(exampleUser);
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

    it('should execute the request with the provided request.__kuid__ if present', () => {
      const customUserRequest = {
        controller: 'foo',
        action: 'bar',
        __kuid__: 'alyx'
      };
      exampleUser._id = customUserRequest.__kuid__;
      kuzzle.funnel.executePluginRequest.resolvesArg(0);

      funnelProtocol = new FunnelProtocol();
      kuzzle.ask
        .withArgs('core:security:user:get', customUserRequest.__kuid__)
        .resolves(exampleUser);
      exampleUser.isActionAllowed = sinon.stub().resolves(true);

      return funnelProtocol.query(customUserRequest)
        .then(response => {
          should(kuzzle.ask.withArgs('core:security:user:get', customUserRequest.__kuid__))
            .be.calledOnce();
          should(response.result.context.user._id).be.eql(customUserRequest.__kuid__);
        });
    });

    it('should throw if the provided User is not allowed to execute a request', async () => {
      const customUserRequest = {
        controller: 'foo',
        action: 'bar',
        __kuid__: 'leo',
        __checkRights__: true
      };
      exampleUser._id = customUserRequest.__kuid__;
      kuzzle.funnel.executePluginRequest.resolvesArg(0);

      funnelProtocol = new FunnelProtocol();
      kuzzle.ask
        .withArgs('core:security:user:get', customUserRequest.__kuid__)
        .resolves(exampleUser);
      exampleUser.isActionAllowed = sinon.stub().resolves(false);

      await should(funnelProtocol.query(customUserRequest))
        .rejectedWith(ForbiddenError, {
          id: 'security.rights.forbidden'
        });
    });

    it('should throw if the provided request.__kuid__ is invalid', async () => {
      const badlyFormattedRequest = {
        controller: 'foo',
        action: 'bar',
        __kuid__: 1
      };
      kuzzle.funnel.executePluginRequest.resolvesArg(0);
      funnelProtocol = new FunnelProtocol();

      await should(funnelProtocol.query(badlyFormattedRequest))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.context.invalid_user'
        });
    });
  });
});
