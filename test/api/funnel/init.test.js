'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Funnel = require('../../../lib/api/funnel'),
  AuthController = require('../../../lib/api/controllers/auth'),
  BulkController = require('../../../lib/api/controllers/bulk'),
  CollectionController = require('../../../lib/api/controllers/collection'),
  DocumentController = require('../../../lib/api/controllers/document'),
  IndexController = require('../../../lib/api/controllers/index'),
  MSController = require('../../../lib/api/controllers/memoryStorage'),
  RealtimeController = require('../../../lib/api/controllers/realtime'),
  SecurityController = require('../../../lib/api/controllers/security'),
  ServerController = require('../../../lib/api/controllers/server'),
  AdminController = require('../../../lib/api/controllers/admin');

describe('funnel.init', () => {
  it('should initialize API and plugins controller', () => {
    const
      kuzzle = new KuzzleMock(),
      funnel = new Funnel(kuzzle);

    sinon.stub(funnel.rateLimiter, 'init');
    funnel.init();

    should(funnel.rateLimiter).calledOnce().calledWith(kuzzle);
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
