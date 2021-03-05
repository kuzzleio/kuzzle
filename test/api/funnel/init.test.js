'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Funnel = require('../../../lib/api/funnel');
const {
  AdminController,
  AuthController,
  BulkController,
  ClusterController,
  CollectionController,
  DocumentController,
  IndexController,
  MemoryStorageController,
  RealtimeController,
  SecurityController,
  ServerController,
} = require('../../../lib/api/controllers');

describe('funnel.init', () => {
  it('should initialize API and plugins controller', async () => {
    const kuzzle = new KuzzleMock();

    kuzzle.ask.withArgs('core:security:user:anonymous:get').resolves({_id: '-1'});

    const funnel = new Funnel();

    sinon.stub(funnel.rateLimiter, 'init');
    await funnel.init();

    should(funnel.rateLimiter.init).calledOnce();
    should(funnel.controllers.size).be.eql(12);
    should(funnel.controllers.get('auth')).be.instanceOf(AuthController);
    should(funnel.controllers.get('bulk')).be.instanceOf(BulkController);
    should(funnel.controllers.get('cluster')).be.instanceOf(ClusterController);
    should(funnel.controllers.get('collection')).be.instanceOf(CollectionController);
    should(funnel.controllers.get('document')).be.instanceOf(DocumentController);
    should(funnel.controllers.get('index')).be.instanceOf(IndexController);
    should(funnel.controllers.get('memoryStorage')).be.instanceOf(MemoryStorageController);
    should(funnel.controllers.get('ms')).be.instanceOf(MemoryStorageController);
    should(funnel.controllers.get('realtime')).be.instanceOf(RealtimeController);
    should(funnel.controllers.get('security')).be.instanceOf(SecurityController);
    should(funnel.controllers.get('server')).be.instanceOf(ServerController);
    should(funnel.controllers.get('admin')).be.instanceOf(AdminController);
  });
});
