'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

describe('funnelController.executePluginRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
    funnel.controllers.testme = {action: sinon.stub()};
    funnel.getRequestSlot = sinon.stub();
    funnel._historize = sinon.stub();
    funnel.handleErrorDump = sinon.stub();
  });

  it('should fail if an unknown controller is invoked', done => {
    const rq = new Request({controller: 'foo', action: 'bar'});

    const ret = funnel.executePluginRequest(rq, true, (err, res) => {
      try {
        should(res).be.undefined();
        should(err).be.instanceOf(BadRequestError);
        should(err.message).be.eql('Unknown controller foo');
        should(funnel.getRequestSlot.called).be.false();
        should(kuzzle.pluginsManager.trigger.called).be.false();
        done();
      }
      catch (e) {
        done(e);
      }
    });

    should(ret).be.eql(1);
  });

  it('should execute without requesting a slot if asked to', done => {
    const rq = new Request({controller: 'testme', action: 'action'});

    funnel.controllers.testme.action.resolves(rq);

    const ret = funnel.executePluginRequest(rq, false, (err, res) => {
      try {
        should(err).be.null();
        should(res).be.eql(rq);
        should(funnel.getRequestSlot.called).be.false();
        should(funnel._historize).calledOnce().calledWith(rq);
        should(rq.status).be.eql(200);
        should(kuzzle.pluginsManager.trigger.called).be.false();
        done();
      }
      catch (e) {
        done(e);
      }
    });

    should(ret).be.eql(0);
  });

  it('should execute the request if a slot is immediately available', done => {
    const rq = new Request({controller: 'testme', action: 'action'});

    funnel.controllers.testme.action.callsFake(() => {
      rq.status = 333;
      return Promise.resolve(rq);
    });
    funnel.getRequestSlot.returns(true);

    const callback = (err, res) => {
      try {
        should(err).be.null();
        should(res).be.eql(rq);
        should(funnel.getRequestSlot).calledOnce().calledWith('executePluginRequest', rq, callback);
        should(funnel._historize).calledOnce().calledWith(rq);
        should(rq.status).be.eql(333);
        should(kuzzle.pluginsManager.trigger.called).be.false();
        done();
      }
      catch (e) {
        done(e);
      }
    };

    should(funnel.executePluginRequest(rq, true, callback)).be.eql(0);
  });

  it('should delay the request if a slot is not yet available', () => {
    const 
      rq = new Request({controller: 'testme', action: 'action'}),
      callback = sinon.stub();

    funnel.getRequestSlot.returns(false);

    should(funnel.executePluginRequest(rq, true, callback)).be.eql(-1);
    should(funnel.getRequestSlot).calledOnce().calledWith('executePluginRequest', rq, callback);
    should(funnel.controllers.testme.action.called).be.false();
    should(funnel._historize.called).be.false();
    should(rq.status).be.eql(102);
    should(callback.called).be.false();
    should(kuzzle.pluginsManager.trigger.called).be.false();
  });

  it('should reject the request if unable to get a slot', () => {
    const 
      rq = new Request({controller: 'testme', action: 'action'}),
      callback = sinon.stub(),
      error = new BadRequestError('foobar');

    funnel.getRequestSlot.callsFake(() => {
      rq.setError(error);
      return false;
    });

    should(funnel.executePluginRequest(rq, true, callback)).be.eql(1);
    should(funnel.getRequestSlot).calledOnce().calledWith('executePluginRequest', rq, callback);
    should(funnel.controllers.testme.action.called).be.false();
    should(funnel._historize.called).be.false();
    should(rq.status).be.eql(error.status);
    should(callback).calledOnce().calledWith(error);
    should(kuzzle.pluginsManager.trigger.called).be.false();
  });

  it('should forward a controller error to the callback', done => {
    const 
      rq = new Request({controller: 'testme', action: 'action'}),
      error = new Error('foobar');

    funnel.controllers.testme.action.rejects(error);
    funnel.getRequestSlot.returns(true);

    const callback = (err, res) => {
      try {
        should(err).be.eql(error);
        should(res).be.undefined();
        should(funnel.getRequestSlot).calledOnce().calledWith('executePluginRequest', rq, callback);
        should(funnel._historize).calledOnce().calledWith(rq);
        should(rq.status).be.eql(500);
        should(funnel.handleErrorDump.called).be.true();
        should(kuzzle.pluginsManager.trigger.called).be.false();
        done();
      }
      catch (e) {
        done(e);
      }
    };

    should(funnel.executePluginRequest(rq, true, callback)).be.eql(0);
  });
});
