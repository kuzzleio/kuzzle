'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  { MockNativeController } = require('../../mocks/controller.mock'),
  FunnelController = require('../../../lib/api/funnel'),
  {
    Request,
    NotFoundError
  } = require('kuzzle-common-objects');

describe('funnel.executePluginRequest', () => {
  let
    kuzzle,
    originalHandleErrorDump,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
    funnel.controllers.set('testme', new MockNativeController(kuzzle));
    originalHandleErrorDump = funnel.handleErrorDump;
    funnel.handleErrorDump = sinon.stub();
  });

  it('should fail if an unknown controller is invoked', () => {
    const rq = new Request({controller: 'foo', action: 'bar'});

    return funnel.executePluginRequest(rq)
      .then(() => Promise.reject(new Error('Should not resolve')))
      .catch(err => {
        should(err).be.instanceOf(NotFoundError);
        should(err.id).be.eql('api.process.controller_not_found');
        should(kuzzle.emit).not.be.called();
      });
  });

  it('should execute the request', () => {
    const rq = new Request({controller: 'testme', action: 'succeed'});

    return funnel.executePluginRequest(rq)
      .then(res => {
        should(funnel.controllers.get('testme').succeed)
          .calledOnce()
          .calledWith(rq);

        should(res).equal(rq);
      });
  });

  it('should dump on errors in whitelist', done => {
    funnel.handleErrorDump = originalHandleErrorDump;
    kuzzle.dump = sinon.stub();
    kuzzle.config.dump.enabled = true;

    const rq = new Request({controller: 'testme', action: 'fail'});

    const callback = () => {
      setTimeout(() => {
        try {
          should(kuzzle.log.error).be.calledOnce();
          should(kuzzle.dump).be.called();
          done();
        } catch (e) {
          done(e);
        }
      }, 50);
    };

    funnel.executePluginRequest(rq)
      .then(() => done(new Error('Should not resolve')))
      .catch (e => {
        if (e === funnel.controllers.get('testme').failResult) {
          return callback();
        }
        done(e);
      });
  });

  it('should not dump on errors if dump is disabled', done => {
    funnel.handleErrorDump = originalHandleErrorDump;
    kuzzle.dump = sinon.stub();
    kuzzle.config.dump.enabled = false;

    const rq = new Request({controller: 'testme', action: 'fail'});

    const callback = () => {
      setTimeout(() => {
        try {
          should(kuzzle.dump).not.be.called();
          done();
        } catch(e) {
          done(e);
        }
      }, 50);
    };

    funnel.executePluginRequest(rq)
      .then(() => done(new Error('Should not resolve')))
      .catch (e => {
        if (e === funnel.controllers.get('testme').failResult) {
          return callback();
        }
        done(e);
      });
  });

});
