'use strict';

const rewire = require('rewire');
const should = require('should');

const { NativeSecurityController } = require('../../../../lib/api/controllers/baseController');
const SecurityController = rewire('../../../../lib/api/controllers/securityController');

describe('/api/controllers/securityController', () => {
  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(new SecurityController()).instanceOf(NativeSecurityController);
    });
  });
});
