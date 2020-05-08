'use strict';

const should = require('should');
const { errors: { BadRequestError } } = require('kuzzle-common-objects');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const Repositories = require('../../../lib/core/security');

/*
 /!\ In these tests, the promise returned by shutdown
 do not mark the function as "finished".
 The promise is resolved before halting Kuzzle in case
 the shutdown is initiated using the CLI, to allow it
 to finish and exit while Kuzzle is shutting down.
 */
describe('security/loadSecurities', () => {
  const securities = require('../../mocks/securities.json');
  let repositories;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    repositories = new Repositories(kuzzle);
  });

  it('should create or replace roles', async () => {
    kuzzle.funnel.processRequest.resolves(true);

    await repositories.loadSecurities(
      { roles: securities.roles },
      { force: true });

    should(kuzzle.funnel.processRequest.callCount).be.eql(2);

    should(kuzzle.funnel.processRequest.getCall(1).args[0].input.action).be.eql('createOrReplaceRole');
    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.resource._id).be.eql('driver');
    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.args.force).be.eql(true);
    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.body.controllers.document.actions['*']).be.eql(true);
  });

  it('should create or replace profiles', async () => {
    kuzzle.funnel.processRequest.resolves(true);

    await repositories.loadSecurities({ profiles: securities.profiles });

    should(kuzzle.funnel.processRequest.callCount).be.eql(2);

    const request = kuzzle.funnel.processRequest.getCall(1).args[0];

    should(request.input.action).be.eql('createOrReplaceProfile');
    should(request.input.resource._id).be.eql('customer');
    should(request.input.body.policies[0].roleId).be.eql('customer');
  });

  it('should reject instead of overwriting existing users', async () => {
    kuzzle.funnel.processRequest
      .onCall(0).resolves({ result: { hits: [{ _id: 'gfreeman' }] } })
      .onCall(1).resolves();

    return should(repositories.loadSecurities({ users: securities.users }))
      .be.rejectedWith(BadRequestError, {
        id: 'security.user.prevent_overwrite'
      });
  });

  it('should skip existing users with onExistingUsers is "skip"', async () => {
    kuzzle.funnel.processRequest
      .onCall(0).resolves({ result: { hits: [{ _id: 'gfreeman' }] } })
      .onCall(1).resolves();

    await repositories.loadSecurities(
      { users: securities.users },
      { onExistingUsers: 'skip' });

    should(kuzzle.funnel.processRequest.callCount).be.eql(2);

    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.action)
      .be.eql('mGetUsers');
    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.body.ids)
      .be.eql(['gfreeman', 'bcalhoun']);

    should(kuzzle.funnel.processRequest.getCall(1).args[0].input.action)
      .be.eql('createUser');
    should(kuzzle.funnel.processRequest.getCall(1).args[0].input.resource._id)
      .be.eql('bcalhoun');
    should(kuzzle.funnel.processRequest.getCall(1).args[0].input.body.content.profileIds)
      .be.eql(['customer']);
  });

  it('should delete only existing users then create users when onExistingUsers is overwrite', async () => {
    kuzzle.funnel.processRequest
      .onCall(0).resolves({ result: { hits: [{ _id: 'gfreeman' }] } })
      .onCall(1).resolves();

    await repositories.loadSecurities(
      { users: securities.users },
      { onExistingUsers: 'overwrite' });

    should(kuzzle.funnel.processRequest.callCount).be.eql(4);

    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.action)
      .be.eql('mGetUsers');
    should(kuzzle.funnel.processRequest.getCall(0).args[0].input.body.ids)
      .be.eql(['gfreeman', 'bcalhoun']);

    should(kuzzle.funnel.processRequest.getCall(1).args[0].input.action)
      .be.eql('mDeleteUsers');
    should(kuzzle.funnel.processRequest.getCall(1).args[0].input.body.ids)
      .be.eql(['gfreeman']);

    should(kuzzle.funnel.processRequest.getCall(2).args[0].input.action)
      .be.eql('createUser');
    should(kuzzle.funnel.processRequest.getCall(2).args[0].input.resource._id)
      .be.eql('gfreeman');
    should(kuzzle.funnel.processRequest.getCall(2).args[0].input.body.content.profileIds)
      .be.eql(['driver']);
  });

  it('should reject if the securities object is null', () => {
    return should(repositories.loadSecurities(null))
      .rejectedWith(BadRequestError, {
        id: 'api.assert.invalid_argument',
        message: 'Invalid argument "null". Expected: object'
      });
  });

  it('should reject if roles contains non-object properties', () => {
    return should(repositories.loadSecurities({
      roles: { foo: 123 },
      profiles: securities.profiles,
      users: securities.users
    }))
      .rejectedWith(BadRequestError, {
        id: 'api.assert.invalid_argument',
        message: 'Invalid argument "123". Expected: object'
      });
  });

  it('should reject if profiles contains non-object properties', () => {
    return should(repositories.loadSecurities({
      roles: securities.roles,
      profiles: { foo: 123 },
      users: securities.users
    }))
      .rejectedWith(BadRequestError, {
        id: 'api.assert.invalid_argument',
        message: 'Invalid argument "123". Expected: object'
      });
  });

  it('should reject if users contains non-object properties', () => {
    kuzzle.funnel.processRequest.resolves({ result: { hits: [] } });

    return should(repositories.loadSecurities({
      roles: {},
      profiles: {},
      users: { foo: 123 },
    }))
      .rejectedWith(BadRequestError, {
        id: 'api.assert.invalid_argument',
        message: 'Invalid argument "123". Expected: object'
      });
  });
});
