'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  {
    InternalError: KuzzleInternalError,
    BadRequestError
  } = require('kuzzle-common-objects').errors;

describe('funnelController.executePluginRequest', () => {
  let
    kuzzle,
    originalHandleErrorDump,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
    funnel.controllers.testme = {action: sinon.stub()};
    originalHandleErrorDump = funnel.handleErrorDump;
    funnel.handleErrorDump = sinon.stub();
  });

  it('should fail if an unknown controller is invoked', () => {
    const rq = new Request({controller: 'foo', action: 'bar'});

    return funnel.executePluginRequest(rq)
      .then(() => Promise.reject(new Error('Should not resolves')))
      .catch(err => {
        should(err).be.instanceOf(BadRequestError);
        should(err.message).be.eql('Unknown controller foo');
        should(kuzzle.pluginsManager.trigger).not.be.called();
      });
  });

  it('should execute the request', () => {
    const
      rq = new Request({controller: 'testme', action: 'action'}),
      result = {foo: 'bar'};

    funnel.controllers.testme.action.callsFake(() => Promise.resolve(result));

    return funnel.executePluginRequest(rq)
      .then(res => {
        should(res).be.equal(result);
      });
  });

  it('should dump on errors in whitelist', (done) => {
    funnel.handleErrorDump = originalHandleErrorDump;
    kuzzle.adminController.dump = sinon.stub();
    kuzzle.config.dump.enabled = true;

    const
      rq = new Request({controller: 'testme', action: 'action'}),
      error = new KuzzleInternalError('foo\nbar');

    funnel.controllers.testme.action.rejects(error);

    const callback = () => {
      setTimeout(() => {
        should(kuzzle.pluginsManager.trigger).be.called();
        should(kuzzle.adminController.dump).be.called();
        done();
      }, 50);
    };

    funnel.executePluginRequest(rq)
      .then(() => done(new Error('Should not resolves')))
      .catch (e => {
        if (e instanceof KuzzleInternalError) {
          return callback();
        }
        done(e);
      });
  });

  it('should not dump on errors if dump is disabled', done => {
    funnel.handleErrorDump = originalHandleErrorDump;
    kuzzle.adminController.dump = sinon.stub();
    kuzzle.config.dump.enabled = false;

    const
      rq = new Request({controller: 'testme', action: 'action'}),
      error = new KuzzleInternalError('foo\nbar');

    funnel.controllers.testme.action.rejects(error);

    const callback = () => {
      setTimeout(() => {
        should(kuzzle.adminController.dump).not.be.called();
        done();
      }, 50);
    };

    funnel.executePluginRequest(rq)
      .then(() => done(new Error('Should not resolves')))
      .catch (e => {
        if (e instanceof KuzzleInternalError) {
          return callback();
        }
        done(e);
      });
  });

});
