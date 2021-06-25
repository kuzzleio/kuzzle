'use strict';

const rewire = require('rewire');
const should = require('should');

const AbstractSecurityController = require('../../../../lib/api/controllers/base/abstractSecurityController');
const SecurityController = rewire('../../../../lib/api/controllers/securityController');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('/api/controllers/securityController', () => {
  describe('#constructor', () => {
    it('should inherit the abstract constructor', () => {
      global.kuzzle = new KuzzleMock();
      should(new SecurityController()).instanceOf(AbstractSecurityController);
    });
  });
});
