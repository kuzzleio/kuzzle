const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  AdminController = rewire('../../../lib/api/controllers/adminController');

describe('Test: admin controller', () => {
  let
    adminController,
    kuzzle,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    adminController = new AdminController(kuzzle);
    request = new Request({ controller: 'admin' });
  });

  describe('#resetCache', done => {
    let flushdbStub = sinon.stub();

    beforeEach(() => {
      request.action = 'resetCache';
    });

    it('should flush the cache for the specified database', done => {
      kuzzle.services.list['memoryStorage'].flushdb = flushdbStub.yields();
      request.input.args.database = 'memoryStorage';

      adminController.resetCache(request)
        .then(() => {
          should(flushdbStub).be.calledOnce();
          done();
        })
        .catch(error => done(error));
    });

    it('should raise an error if database does not exist', done => {
      request.input.args.database = 'city17';

      try {
        adminController.resetCache(request);
        done(new Error('Should not resolves'));
      } catch (e) {
        should(e).be.instanceOf(BadRequestError);
        done();
      }
    });
  });

});
