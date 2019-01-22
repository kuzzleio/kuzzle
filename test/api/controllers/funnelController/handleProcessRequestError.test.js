'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {BadRequestError} = require('kuzzle-common-objects').errors;

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);

    // injects fake controllers for unit tests
    funnel.controllers = {
      'fakeController': {
        ok: sinon.stub().returns(Bluebird.resolve()),
        fail: sinon.stub()
      }
    };

    funnel.pluginsControllers = {
      'fakePlugin/controller': {
        ok: sinon.stub().returns(Bluebird.resolve()),
        fail: sinon.stub(),
        changeError: (request) => {
          request.setError(new BadRequestError('custom erro'));

          return Promise.reject(request);
        }
      }
    };
  });

  it('allows plugin developer to set a new error on request:onError event', done => {
    const
      originalError = new BadRequestError('original error'),
      customError = new BadRequestError('custom error'),
      request = new Request({
        controller: 'fakePlugin/controller',
        action: 'fail',
      });

    kuzzle.pluginsManager.trigger = sinon.stub();
    kuzzle.pluginsManager.trigger.onFirstCall().rejects(originalError);
    kuzzle.pluginsManager.trigger.onSecondCall().callsFake((_, req) => {
      req.setError(customError);

      return Promise.resolve(req);
    });

    funnel.handleProcessRequestError(request, request, funnel.pluginsControllers, originalError)
      .then(() => done('Expected test to fail'))
      .catch(e => {
        try {
          should(e).be.instanceOf(BadRequestError);
          should(e.message).be.eql('custom error');
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });
});
