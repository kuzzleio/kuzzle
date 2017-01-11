const
  rewire = require('rewire'),
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  Request = require('kuzzle-common-objects').Request,
  SecurityController = rewire('../../../../lib/api/controllers/securityController');

describe('/api/controllers/security', () => {
  let
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
  });

  describe('#mDelete', () => {
    const mDelete = SecurityController.__get__('mDelete');

    it('should fail if the request has no body', () => {
      should(() => mDelete(kuzzle, 'type', new Request({})))
        .throw(BadRequestError, {message: 'security:Type must specify a body.'});
    });

    it('should fail if the request has no id', () => {
      const request = new Request({
        body: {}
      });

      should(() => mDelete(kuzzle, 'type', request))
        .throw(BadRequestError, {message: 'security:Type must specify a body attribute "ids".'});

    });

    it('should fail if ids is not an array', () => {
      const request = new Request({
        body: {
          ids: {}
        }
      });

      should(() => mDelete(kuzzle, 'type', request))
        .throw(BadRequestError, {message: 'security:Type "body.ids" must be an array'});
    });

    it('should return the input ids if everything went fine', () => {
      const request = new Request({
        body: {
          ids: [
            'foo',
            'bar',
            'baz'
          ]
        }
      });

      return mDelete(kuzzle, 'type', request)
        .then(ids => {
          should(ids)
            .match([
              'foo',
              'bar',
              'baz'
            ]);
        });
    });

    it('should set a partial error if something went wrong', () => {
      const
        error = new Error('test'),
        request = new Request({
          body: {
            ids: ['foo', 'bar', 'baz']
          }
        });

      kuzzle.funnel.processRequest
        .onCall(1).returns(Promise.reject(error));

      return mDelete(kuzzle, 'type', request)
        .then(() => {
          should(request.error)
            .be.an.instanceOf(PartialError);

          should(request.error.errors)
            .be.an.Array()
            .and.have.length(1);
          should(request.error.errors[0])
            .match(new InternalError(error));
        });
    });
  });
});
