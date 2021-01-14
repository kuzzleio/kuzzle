'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Funnel = require('../../../lib/api/funnel');
const AuthController = require('../../../lib/api/controllers/authController');
const BulkController = require('../../../lib/api/controllers/bulkController');
const CollectionController = require('../../../lib/api/controllers/collectionController');
const DocumentController = require('../../../lib/api/controllers/documentController');
const IndexController = require('../../../lib/api/controllers/indexController');
const MSController = require('../../../lib/api/controllers/memoryStorageController');
const RealtimeController = require('../../../lib/api/controllers/realtimeController');
const SecurityController = require('../../../lib/api/controllers/securityController');
const ServerController = require('../../../lib/api/controllers/serverController');
const AdminController = require('../../../lib/api/controllers/adminController');

describe('funnel.init', () => {
  it('should initialize API and plugins controller', async () => {
    const kuzzle = new KuzzleMock();

    kuzzle.ask.withArgs('core:security:user:anonymous:get').resolves({_id: '-1'});

    const funnel = new Funnel();

    sinon.stub(funnel.rateLimiter, 'init');
    await funnel.init();

    should(funnel.rateLimiter.init).calledOnce();
    should(funnel.controllers.size).be.eql(11);
    should(funnel.controllers.get('auth')).be.instanceOf(AuthController);
    should(funnel.controllers.get('bulk')).be.instanceOf(BulkController);
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
