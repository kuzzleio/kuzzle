'use strict';

const
  rewire = require('rewire'),
  should = require('should'),
  Bluebird = require('bluebird'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    Request,
    errors: {
      BadRequestError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  SecurityController = rewire('../../../../lib/api/controllers/security');

describe('Test: security controller - roles', () => {
  let
    kuzzle,
    request,
    securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);

    request = new Request({controller: 'security'});
    kuzzle.internalIndex.get.resolves({});
    kuzzle.internalIndex.getMapping.resolves({internalIndex: {mappings: {roles: {properties: {}}}}});
  });

  describe('#updateRoleMapping', () => {
    const foo = {foo: 'bar'};

    it('should throw a BadRequestError if the body is missing', () => {
      return should(() => {
        securityController.updateRoleMapping(request);
      }).throw(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should update the role mapping', () => {
      request.input.body = foo;
      kuzzle.internalIndex.updateMapping.resolves(foo);

      return securityController.updateRoleMapping(request)
        .then(response => {
          should(kuzzle.internalIndex.updateMapping).be.calledOnce();
          should(kuzzle.internalIndex.updateMapping).be.calledWith('roles', request.input.body);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });


  describe('#getRoleMapping', () => {
    it('should fulfill with a response object', () => {
      kuzzle.internalIndex.getMapping.resolves({ properties: { foo: 'bar' } });

      return securityController.getRoleMapping(request)
        .then(response => {
          should(kuzzle.internalIndex.getMapping)
            .be.calledOnce()
            .be.calledWith('roles');

          should(response).be.instanceof(Object);
          should(response).match({ mapping: { foo: 'bar' } });
        });
    });
  });

  describe('#createOrReplaceRole', () => {
    it('should resolve to an object on a createOrReplaceRole call', () => {
      kuzzle.repositories.role.validateAndSaveRole.resolves({_id: 'test'});
      return securityController.createOrReplaceRole(new Request({ _id: 'test', body: { controllers: {} } }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.repositories.role.validateAndSaveRole.rejects(new Error('Mocked error'));
      return should(securityController.createOrReplaceRole(new Request({_id: 'alreadyExists', body: {indexes: {}}})))
        .be.rejectedWith(new Error('Mocked error'));
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.role.validateAndSaveRole.resolves({_id: 'test'});

      return securityController.createOrReplaceRole(new Request({
        _id: 'test',
        body: {
          controllers: {}
        },
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.role.validateAndSaveRole.firstCall.args[1];

          should(options).match({
            refresh: 'wait_for'
          });
        });
    });
  });

  describe('#createRole', () => {
    it('should resolve to an object on a createRole call', () => {
      kuzzle.repositories.role.validateAndSaveRole.resolves({_id: 'test'});
      return should(securityController.createRole(new Request({ _id: 'test', body: { controllers: {} } })))
        .be.fulfilled();
    });
  });

  describe('#getRole', () => {
    it('should resolve to an object on a getRole call', () => {
      kuzzle.repositories.role.load.resolves({
        _id: 'test'
      });

      return securityController.getRole(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject NotFoundError on a getRole call with a bad id', () => {
      kuzzle.repositories.role.load.resolves(null);
      return should(securityController.getRole(new Request({_id: 'badId'}))).be.rejected();
    });
  });

  describe('#mGetRoles', () => {
    it('should throw an error if no ids is provided', () => {
      return should(() => {
        securityController.mGetRoles(new Request({body: {}}));
      }).throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject an error if loading roles fails', () => {
      kuzzle.repositories.role.loadMultiFromDatabase.rejects(new Error('foobar'));

      return should(securityController.mGetRoles(new Request({body: {ids: ['test']}}))).be.rejected();
    });

    it('should resolve to an object', () => {
      kuzzle.repositories.role.loadMultiFromDatabase.resolves([
        { _id: 'test', _source: null }
      ]);

      return securityController.mGetRoles(new Request({body: {ids: ['test']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).not.be.empty();
        });
    });
  });

  describe('#searchRoles', () => {
    it('should return response with an array of roles on searchRole call', () => {
      kuzzle.repositories.role.searchRole.resolves({
        hits: [{_id: 'test'}],
        total: 1
      });

      return securityController.searchRoles(new Request({body: {controllers: ['foo', 'bar']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
          should(kuzzle.repositories.role.searchRole)
            .be.calledOnce()
            .be.calledWith(['foo', 'bar']);
        });
    });

    it('should throw an error if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      request = new Request({body: {policies: ['role1']}});
      request.input.args.from = 0;
      request.input.args.size = 10;

      return should(() => securityController.searchRoles(request))
        .throw(SizeLimitError, { id: 'services.storage.get_limit_exceeded' });
    });

    it('should reject an error in case of error', () => {
      kuzzle.repositories.role.searchRole.rejects(new Error());
      return should(securityController.searchRoles(new Request({body: {controllers: ['foo', 'bar']}}))).be.rejected();
    });
  });

  describe('#updateRole', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.role.load.resolves({_id: 'test'});
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = role => {
        if (role._id === 'alreadyExists') {
          return Bluebird.reject();
        }

        return Bluebird.resolve(role);
      };

      return securityController.updateRole(new Request({ _id: 'test', body: { foo: 'bar' } }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateRole(new Request({body: {}}));
      }).throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      kuzzle.repositories.role.load.resolves(null);
      return should(securityController.updateRole(new Request({_id: 'badId', body: {}, context: {action: 'updateRole'}}))).be.rejected();
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.role.load.resolves({_id: 'test'});
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = sinon.stub().returnsArg(0);

      return securityController.updateRole(new Request({
        _id: 'test',
        body: {
          foo: 'bar'
        },
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.role.validateAndSaveRole.firstCall.args[1];
          should(options).match({
            refresh: 'wait_for'
          });
        });
    });
  });

  describe('#deleteRole', () => {
    it('should return response with on deleteRole call', done => {
      const role = {_id: 'role'};

      kuzzle.repositories.role.load.resolves(role);
      kuzzle.repositories.role.delete.resolves();

      securityController.deleteRole(new Request({ _id: 'test', body: {} }))
        .then(() => {
          should(kuzzle.repositories.role.delete.calledWith(role)).be.true();
          done();
        });
    });

    it('should reject the promise if attempting to delete one of the core roles', () => {
      kuzzle.repositories.role.delete
        .rejects(new Error('admin is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.'));
      return should(securityController.deleteRole(new Request({_id: 'admin',body: {}}))).be.rejected();
    });

    it('should forward refresh option', () => {
      const role = {_id: 'role'};

      kuzzle.repositories.role.load.resolves(role);
      kuzzle.repositories.role.getRoleFromRequest.resolves(role);
      kuzzle.repositories.role.delete.resolves();

      return securityController.deleteRole(new Request({
        _id: 'test',
        body: {},
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.role.delete.firstCall.args[1];

          should(options).match({
            refresh: 'wait_for'
          });
        });
    });
  });

  describe('#mDeleteRoles', () => {
    it('should forward its args to mDelete', () => {
      const spy = sinon.spy();

      SecurityController.__with__({
        mDelete: spy
      })(() => {
        securityController.mDeleteRoles(request);

        should(spy)
          .be.calledOnce()
          .be.calledWith(kuzzle, 'role', request);
      });
    });
  });
});
