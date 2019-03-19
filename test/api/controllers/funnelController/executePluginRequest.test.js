'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  ControllerMock = require('../../../mocks/controller.mock'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  {
    Request,
    errors: { BadRequestError }
  } = require('kuzzle-common-objects');

describe('funnelController.executePluginRequest', () => {
  let
    kuzzle,
    originalHandleErrorDump,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
    funnel.controllers.testme = new ControllerMock(kuzzle);
    originalHandleErrorDump = funnel.handleErrorDump;
    funnel.handleErrorDump = sinon.stub();
  });

  it('should fail if an unknown controller is invoked', () => {
    const rq = new Request({controller: 'foo', action: 'bar'});

    return funnel.executePluginRequest(rq)
      .then(() => Promise.reject(new Error('Should not resolve')))
      .catch(err => {
        should(err).be.instanceOf(BadRequestError);
        should(err.message).be.eql('Unknown controller foo');
        should(kuzzle.pluginsManager.trigger).not.be.called();
      });
  });

  it('should execute the request', () => {
    const rq = new Request({controller: 'testme', action: 'succeed'});

    return funnel.executePluginRequest(rq)
      .then(res => {
        should(funnel.controllers.testme.succeed)
          .calledOnce()
          .calledWith(rq);

        should(res).equal(rq);
      });
  });

  it('should dump on errors in whitelist', done => {
    funnel.handleErrorDump = originalHandleErrorDump;
    kuzzle.adminController.dump = sinon.stub();
    kuzzle.config.dump.enabled = true;

    const rq = new Request({controller: 'testme', action: 'fail'});

    const callback = () => {
      setTimeout(() => {
        try {
          should(kuzzle.pluginsManager.trigger).be.called();
          should(kuzzle.adminController.dump).be.called();
          done();
        } catch (e) {
          done(e);
        }
      }, 50);
    };

    funnel.executePluginRequest(rq)
      .then(() => done(new Error('Should not resolve')))
      .catch (e => {
        if (e === funnel.controllers.testme.failResult) {
          return callback();
        }
        done(e);
      });
  });

  it('should not dump on errors if dump is disabled', done => {
    funnel.handleErrorDump = originalHandleErrorDump;
    kuzzle.adminController.dump = sinon.stub();
    kuzzle.config.dump.enabled = false;

    const rq = new Request({controller: 'testme', action: 'fail'});

    const callback = () => {
      setTimeout(() => {
        try {
          should(kuzzle.adminController.dump).not.be.called();
          done();
        } catch(e) {
          done(e);
        }
      }, 50);
    };

    funnel.executePluginRequest(rq)
      .then(() => done(new Error('Should not resolve')))
      .catch (e => {
        if (e === funnel.controllers.testme.failResult) {
          return callback();
        }
        done(e);
      });
  });

});
