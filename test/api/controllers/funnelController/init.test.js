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

    should(Object.keys(funnel.controllers).length).be.eql(11);
    should(funnel.controllers.auth).be.instanceOf(AuthController);
    should(funnel.controllers.bulk).be.instanceOf(BulkController);
    should(funnel.controllers.collection).be.instanceOf(CollectionController);
    should(funnel.controllers.document).be.instanceOf(DocumentController);
    should(funnel.controllers.index).be.instanceOf(IndexController);
    should(funnel.controllers.memoryStorage).be.instanceOf(MSController);
    should(funnel.controllers.ms).be.instanceOf(MSController);
    should(funnel.controllers.realtime).be.instanceOf(RealtimeController);
    should(funnel.controllers.security).be.instanceOf(SecurityController);
    should(funnel.controllers.server).be.instanceOf(ServerController);
    should(funnel.controllers.admin).be.instanceOf(AdminController);
    should(funnel.pluginsControllers).match({foo: 'bar'});
  });
});
