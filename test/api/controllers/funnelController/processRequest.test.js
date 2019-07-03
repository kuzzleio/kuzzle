'use strict';

const
  should = require('should'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  DocumentController = require('../../../../lib/api/controllers/documentController'),
  mockrequire = require('mock-require'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  ControllerMock = require('../../../mocks/controller.mock'),
  ElasticsearchClientMock = require('../../../mocks/services/elasticsearchClient.mock'),
  {
    Request,
    errors: {
      BadRequestError,
      PluginImplementationError,
      InternalError: KuzzleInternalError
    }
  } = require('kuzzle-common-objects');

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    funnel,
    pluginsManager;

  beforeEach(() => {
    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire('../../../../lib/services/internalEngine');
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');
    mockrequire.reRequire('../../../../lib/api/core/plugins/privilegedPluginContext');
    const PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);

    kuzzle.emit.restore();
    pluginsManager = new PluginsManager(kuzzle);
    kuzzle.pluginsManager = pluginsManager;

    // inject fake controllers for unit tests
    funnel.controllers.fakeController = new ControllerMock(kuzzle);
    funnel.controllers.document = new DocumentController(kuzzle);
    funnel.pluginsControllers['fakePlugin/controller'] =
      new ControllerMock(kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should throw if no controller is specified', () => {
    const request = new Request({action: 'create'});

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {message: 'Unknown controller null'});
    should(kuzzle.pipe)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pipe)
      .not.calledWith('request:onError', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if no action is specified', () => {
    const request = new Request({controller: 'fakeController'});

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {
        message: 'No corresponding action null in controller fakeController'
      });
    should(kuzzle.pipe)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pipe)
      .not.calledWith('request:onError', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if the action does not exist', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'create'
    });

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {
        message: 'No corresponding action create in controller fakeController'
      });
    should(kuzzle.pipe)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pipe)
      .not.calledWith('request:onError', request);
    should(kuzzle.pipe)
      .not.calledWith('fakeController:errorCreate', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if a plugin action does not exist', () => {
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'create'});

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {
        message: `No corresponding action create in controller ${controller}`
      });
    should(kuzzle.pipe)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pipe)
      .not.calledWith('request:onError', request);
    should(kuzzle.pipe)
      .not.calledWith('fakePlugin/controller:errorCreate', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if a plugin action returns a non-thenable object', done => {
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'succeed'});

    funnel.pluginsControllers[controller].succeed.returns('foobar');

    funnel.processRequest(request)
      .then(() => done(new Error('Expected test to fail')))
      .catch(e => {
        try {
          should(e).be.instanceOf(PluginImplementationError);
          should(e.message).startWith(
            `Unexpected return value from action ${controller}/succeed: expected a Promise`);
          should(kuzzle.pipe)
            .not.calledWith('request:onSuccess', request);
          should(kuzzle.pipe)
            .calledWith('request:onError', request);
          should(kuzzle.pipe)
            .calledWith(`${controller}:errorSucceed`, request);
          should(kuzzle.statistics.startRequest).be.called();
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });

  it('should throw if a plugin action returns a non-serializable response', () => {
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'succeed'}),
      unserializable = {};
    unserializable.self = unserializable;

    funnel.pluginsControllers[controller].succeed.resolves(unserializable);

    return funnel.processRequest(request)
      .then(() => { throw new Error('Expected test to fail'); })
      .catch(e => {
        should(e).be.an.instanceOf(PluginImplementationError);
        should(e.message).startWith('Unable to serialize response. Are you trying to return the request?');
      });
  });

  it('should resolve the promise if everything is ok', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'succeed'
    });

    return funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(kuzzle.pipe)
          .calledWith('fakeController:beforeSucceed');
        should(kuzzle.pipe)
          .calledWith('fakeController:afterSucceed');
        should(kuzzle.pipe)
          .calledWith('request:onSuccess', request);
        should(kuzzle.pipe)
          .not.calledWith('request:onError', request);
        should(kuzzle.pipe)
          .not.calledWith('fakeController:errorSucceed', request);
        should(kuzzle.statistics.startRequest).be.called();
        should(kuzzle.statistics.completedRequest).be.called();
        should(kuzzle.statistics.failedRequest).not.be.called();
      });
  });

  it('should reject the promise if a controller action fails', done => {
    const request = new Request({
      controller: 'fakeController',
      action: 'fail',
    });

    funnel.processRequest(request)
      .then(() => done(new Error('Expected test to fail')))
      .catch(e => {
        try {
          should(e).be.instanceOf(KuzzleInternalError);
          should(e.message).be.eql('rejected action');
          should(kuzzle.pipe)
            .calledWith('fakeController:beforeFail');
          should(kuzzle.pipe)
            .not.be.calledWith('fakeController:afterFail');
          should(kuzzle.pipe)
            .not.calledWith('request:onSuccess', request);
          should(kuzzle.pipe)
            .calledWith('request:onError', request);
          should(kuzzle.pipe)
            .calledWith('fakeController:errorFail', request);
          should(kuzzle.statistics.startRequest).be.called();
          should(kuzzle.statistics.completedRequest).not.be.called();
          should(kuzzle.statistics.failedRequest).be.called();
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });

  it('should wrap a Node error on a plugin action failure', done => {
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'fail'});

    funnel.pluginsControllers[controller].fail.rejects(new Error('foobar'));

    funnel.processRequest(request)
      .then(() => done(new Error('Expected test to fail')))
      .catch(e => {
        try {
          should(e).be.instanceOf(PluginImplementationError);
          should(e.message).startWith('foobar');
          should(kuzzle.pipe)
            .calledWith(`${controller}:beforeFail`);
          should(kuzzle.pipe)
            .not.be.calledWith(`${controller}:afterFail`);
          should(kuzzle.pipe)
            .not.calledWith('request:onSuccess', request);
          should(kuzzle.pipe)
            .calledWith('request:onError', request);
          should(kuzzle.pipe)
            .calledWith('fakePlugin/controller:errorFail', request);
          should(kuzzle.statistics.startRequest).be.called();
          should(kuzzle.statistics.completedRequest).not.be.called();
          should(kuzzle.statistics.failedRequest).be.called();
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });

  it('should update the query documents with alias pipe', done => {
    kuzzle.pipe.restore();

    pluginsManager.plugins = [{
      object: {
        init: () => {},
        pipes: {
          'generic:document:beforeWrite': function hello(documents) {
            should(documents[0]._id).equal(null);
      
            documents[0]._id = 'foobar';
      
            return Promise.resolve(documents);
          },
          'document:beforeCreate': (request) => {
            should(request.input.resource._id).equal('foobar');
  
            done();
            return Promise.resolve(request);
          },
        },
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    const request = new Request({
      controller: 'document',
      action: 'create',
      index: 'foo',
      collection: 'bar',
      body: {
        foo: 'bar',
      }
    });

    pluginsManager.run()
      .then(() => {
        funnel.processRequest(request);
      });
  });

});
