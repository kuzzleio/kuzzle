'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  AuthController = require('../../../../lib/api/controllers/authController'),
  BulkController = require('../../../../lib/api/controllers/bulkController'),
  CollectionController = require('../../../../lib/api/controllers/collectionController'),
  DocumentController = require('../../../../lib/api/controllers/documentController'),
  IndexController = require('../../../../lib/api/controllers/indexController'),
  MSController = require('../../../../lib/api/controllers/memoryStorageController'),
  RealtimeController = require('../../../../lib/api/controllers/realtimeController'),
  SecurityController = require('../../../../lib/api/controllers/securityController'),
  ServerController = require('../../../../lib/api/controllers/serverController'),
  AdminController = require('../../../../lib/api/controllers/adminController');

describe('funnelController.init', () => {
  it('should initialize API and plugins controller', () => {
    const
      kuzzle = new KuzzleMock(),
      funnel = new FunnelController(kuzzle);

    kuzzle.pluginsManager.getPluginControllers = sinon.stub().returns({foo: 'bar'});

    funnel.init();
    funnel.loadPluginControllers();

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
    should(funnel.pluginsControllers).have.value('foo', 'bar');
  });
});
