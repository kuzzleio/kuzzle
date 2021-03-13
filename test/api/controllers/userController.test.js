'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  BadRequestError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const UserController = require('../../../lib/api/controllers/userController');
const User = require('../../../lib/model/security/user');

describe('UserController', () => {
  let kuzzle;
  let request;
  let userController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    userController = new UserController();
    userController.anonymousId = '-1';
    request = new Request({ controller: 'user' }, { user: new User() });

    request.context.user._id = '4';
  });

  describe('#create', () => {
    const createdUser = {_id: 'foo', _source: { bar: 'baz' } };

    beforeEach(() => {
      sinon.stub(userController, '_persistUser').resolves(createdUser);
      request.input.resource._id = 'test';
      request.input.body = {
        content: { name: 'John Doe', profileIds: ['default'] }
      };
    });

    it('should return a valid response', async () => {
      const response = await userController.create(request);

      should(userController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['default'], { name: 'John Doe' });

      should(response).eql(createdUser);
    });

    it('should reject if no body is provided', async () => {
      request.input.body = null;

      await should(userController.create(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });

      should(userController._persistUser).not.called();
    });

    it('should reject if no profileId is given', async () => {
      delete request.input.body.content.profileIds;

      await should(userController.create(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.content.profileIds".'
        });

      should(userController._persistUser).not.called();
    });

    it('should reject if profileIds is not an array', async () => {
      request.input.body.content.profileIds = {};

      await should(userController.create(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "body.content.profileIds" (expected: array)'
        });

      should(userController._persistUser).not.called();
    });
  });
});