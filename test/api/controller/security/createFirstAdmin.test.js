'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require('rewire');
const SecurityController = rewire('../../../../lib/api/controller/security');
const {
  Request,
  errors: {PreconditionError},
} = require('kuzzle-common-objects');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: security controller - createFirstAdmin', () => {
  let securityController;
  let kuzzle;
  let resetRolesStub;
  let resetProfilesStub;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);
    sinon.stubb(securityController, '_persistUser');

    resetRolesStub = kuzzle.ask.withArgs(
      'core:security:role:createOrReplace',
      sinon.match.string,
      sinon.match.object,
      sinon.match.any);

    resetProfilesStub = kuzzle.ask.withArgs(
      'core:security:profile:createOrReplace',
      sinon.match.string,
      sinon.match.object,
      sinon.match.any);
  });

  describe('#createFirstAdmin', () => {
    it('should reject if an admin already exists', () => {
      const request = new Request(
        {
          controller: 'security',
          action: 'createFirstAdmin',
          _id: 'toto',
          body: {content: {password: 'pwd'}}
        });

      kuzzle.adminExists.resolves(true);

      return should(securityController.createFirstAdmin(request))
        .be.rejectedWith(PreconditionError, {id: 'api.process.admin_exists'});
    });

    it('should create the admin user and not reset roles & profiles if not asked to', async () => {
      const request = new Request({
        _id: 'toto',
        action: 'createFirstAdmin',
        controller: 'security',
      });

      kuzzle.adminExists.resolves(false);

      await securityController.createFirstAdmin(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['admin'], {});
      should(resetRolesStub).not.called();
      should(resetProfilesStub).not.called();
      should(kuzzle.internalIndex.refreshCollection).not.called();
    });

    it('should create the admin user and reset roles & profiles if asked to', async () => {
      const request = new Request({
        _id: 'toto',
        action: 'createFirstAdmin',
        body: {content: {foo: 'bar'}},
        controller: 'security',
        reset: true,
      });

      kuzzle.adminExists.resolves(false);

      await securityController.createFirstAdmin(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['admin'], request.body.content);

      for (const [key, content] of kuzzle.config.security.standard.roles) {
        should(resetRolesStub).calledWithMatch(
          'core:security:role:createOrReplace',
          key,
          content);
      }

      for (const [key, content] of kuzzle.config.security.standard.profiles) {
        should(resetRolesStub).calledWithMatch(
          'core:security:profile:createOrReplace',
          key,
          content);
      }

      should(kuzzle.internalIndex.refreshCollection).be.calledWith('users');
    });
  });
});
