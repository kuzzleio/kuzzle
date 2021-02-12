'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Funnel = require('../../../lib/api/funnel');
const AuthController = require('../../../lib/api/controller/auth');
const BulkController = require('../../../lib/api/controller/bulk');
const ClusterController = require('../../../lib/api/controller/cluster');
const CollectionController = require('../../../lib/api/controller/collection');
const DocumentController = require('../../../lib/api/controller/document');
const IndexController = require('../../../lib/api/controller/index');
const MSController = require('../../../lib/api/controller/memoryStorage');
const RealtimeController = require('../../../lib/api/controller/realtime');
const SecurityController = require('../../../lib/api/controller/security');
const ServerController = require('../../../lib/api/controller/server');
const AdminController = require('../../../lib/api/controller/admin');

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
    should(funnel.controllers.get('memoryStorage')).be.instanceOf(MSController);
    should(funnel.controllers.get('ms')).be.instanceOf(MSController);
    should(funnel.controllers.get('realtime')).be.instanceOf(RealtimeController);
    should(funnel.controllers.get('security')).be.instanceOf(SecurityController);
    should(funnel.controllers.get('server')).be.instanceOf(ServerController);
    should(funnel.controllers.get('admin')).be.instanceOf(AdminController);
  });
});
