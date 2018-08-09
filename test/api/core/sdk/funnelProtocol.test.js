'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  FunnelProtocol = require('../../../../lib/api/core/sdk/funnelProtocol');

describe('Test: sdk/funnelProtocol', () => {
  let funnelProtocol;

  const funnel = {};

  beforeEach(() => {
    funnel.getControllers = sinon.stub().returns({
      foo: 'bar',
      bar: 'baz'
    });

    funnel.callController = sinon.stub().resolves('sdk result');

    funnelProtocol = new FunnelProtocol(funnel);
  });

  describe('#isReady', () => {
    it('should return true', () => {
      should(funnelProtocol.isReady()).be.true();
    });
  });

  describe('#query', () => {
    it('should call getControllers with the constructed request', () => {
      return funnelProtocol.query({controller: 'foo', action: 'bar'})
        .then(() => {
          should(funnel.getControllers).be.calledOnce();

          const req = funnel.getControllers.firstCall.args[0];
          should(req).be.an.instanceOf(Request);
          should(req.input.controller).be.equal('foo');
          should(req.input.action).be.equal('bar');
        });
    });

    it('should call callController with the constructed request', () => {
      return funnelProtocol.query({controller: 'foo', action: 'bar'})
        .then(() => {
          should(funnel.callController).be.calledOnce();

          const
            controllers = funnel.callController.firstCall.args[0],
            req = funnel.callController.firstCall.args[1];

          should(controllers).match({foo: 'bar', bar: 'baz'});

          should(req).be.an.instanceOf(Request);
          should(req.input.controller).be.equal('foo');
          should(req.input.action).be.equal('bar');
        });
    });

    it('should return the result in the good format', () => {
      return funnelProtocol.query({controller: 'foo', action: 'bar'})
        .then(res => {
          should(res.result).be.exactly('sdk result');
        });
    });
  });
});
