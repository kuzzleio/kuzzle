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
    funnel._historize = sinon.stub();
    funnel.handleErrorDump = sinon.stub();
  });

  it('should fail if an unknown controller is invoked', done => {
    const rq = new Request({controller: 'foo', action: 'bar'});

    const ret = funnel.executePluginRequest(rq, (err, res) => {
      try {
        should(res).be.undefined();
        should(err).be.instanceOf(BadRequestError);
        should(err.message).be.eql('Unknown controller foo');
        should(kuzzle.pluginsManager.trigger.called).be.false();
        done();
      }
      catch (e) {
        done(e);
      }
    });

    should(ret).be.eql(1);
  });

  it('should execute the request', done => {
    const rq = new Request({controller: 'testme', action: 'action'});

    funnel.controllers.testme.action.callsFake(() => {
      rq.status = 333;
      return Promise.resolve(rq);
    });

    const callback = (err, res) => {
      try {
        should(err).be.null();
        should(res).be.eql(rq);
        should(funnel._historize).calledOnce().calledWith(rq);
        should(rq.status).be.eql(333);
        should(kuzzle.pluginsManager.trigger.called).be.false();
        done();
      }
      catch (e) {
        done(e);
      }
    };

    should(funnel.executePluginRequest(rq, callback)).be.eql(0);
  });

  it('should forward a controller error to the callback', done => {
    const 
      rq = new Request({controller: 'testme', action: 'action'}),
      error = new Error('foobar');

    funnel.controllers.testme.action.rejects(error);

    const callback = (err, res) => {
      try {
        should(err).be.eql(error);
        should(res).be.undefined();
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

    should(funnel.executePluginRequest(rq, callback)).be.eql(0);
  });

});
