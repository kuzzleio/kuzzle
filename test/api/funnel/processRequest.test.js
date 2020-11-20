'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const {
  Request,
  NotFoundError,
  PluginImplementationError,
  InternalError: KuzzleInternalError,
  BadRequestError
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const {
  MockBaseController,
  MockNativeController,
} = require('../../mocks/controller.mock');
const ElasticsearchClientMock = require('../../mocks/service/elasticsearchClient.mock');

const Funnel = require('../../../lib/api/funnel');
const DocumentController = require('../../../lib/api/controller/document');

describe('funnel.processRequest', () => {
  let kuzzle;
  let funnel;
  let pluginsManager;

  const pluginGetControllersEvent = 'core:plugin:controllers:get';
  let pluginGetControllersStub;

  beforeEach(() => {
    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire('../../../lib/core/plugin/pluginContext');
    mockrequire.reRequire('../../../lib/core/plugin/privilegedContext');
    const PluginsManager = mockrequire.reRequire('../../../lib/core/plugin/pluginsManager');

    kuzzle = new KuzzleMock();
    funnel = new Funnel(kuzzle);

    kuzzle.emit.restore();

    pluginsManager = new PluginsManager(kuzzle);
    kuzzle.pluginsManager = pluginsManager;

    // inject fake controllers for unit tests
    funnel.controllers.set('fakeController', new MockNativeController(kuzzle));
    funnel.controllers.set('document', new DocumentController(kuzzle));

    pluginGetControllersStub = kuzzle.ask
      .withArgs(pluginGetControllersEvent)
      .resolves(new Map([
        ['fakePlugin/controller', new MockBaseController(kuzzle)]
      ]));
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should reject if no controller is specified', () => {
    const request = new Request({action: 'create'});

    return should(funnel.processRequest(request))
      .rejectedWith(NotFoundError, {id: 'api.process.controller_not_found'})
      .then(() => {
        should(kuzzle.pipe).not.calledWith('request:onSuccess', request);
        should(kuzzle.pipe).not.calledWith('request:onError', request);
        should(kuzzle.statistics.startRequest).not.be.called();
      });
  });

  it('should reject if no action is specified', () => {
    const request = new Request({controller: 'fakeController'});

    return should(funnel.processRequest(request))
      .rejectedWith(NotFoundError, { id: 'api.process.action_not_found' })
      .then(() => {
        should(kuzzle.pipe).not.calledWith('request:onSuccess', request);
        should(kuzzle.pipe).not.calledWith('request:onError', request);
        should(kuzzle.statistics.startRequest).not.be.called();
      });
  });

  it('should reject if the action does not exist', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'create'
    });

    return should(funnel.processRequest(request))
      .rejectedWith(NotFoundError, { id: 'api.process.action_not_found' })
      .then(() => {
        should(kuzzle.pipe).not.calledWith('request:onSuccess', request);
        should(kuzzle.pipe).not.calledWith('request:onError', request);
        should(kuzzle.pipe)
          .not.calledWith('fakeController:errorCreate', request);
        should(kuzzle.statistics.startRequest).not.be.called();
      });
  });

  it('should throw if a plugin action does not exist', () => {
    const controller = 'fakePlugin/controller';
    const request = new Request({controller, action: 'create'});

    return should(funnel.processRequest(request))
      .rejectedWith(NotFoundError, { id: 'api.process.action_not_found' })
      .then(() => {
        should(kuzzle.pipe).not.calledWith('request:onSuccess', request);
        should(kuzzle.pipe).not.calledWith('request:onError', request);
        should(kuzzle.pipe)
          .not.calledWith('fakePlugin/controller:errorCreate', request);
        should(kuzzle.statistics.startRequest).not.be.called();
      });
  });

  it('should reject if a plugin action returns a non-thenable object', () => {
    const controller = 'fakePlugin/controller';
    const controllerMock = new MockBaseController(kuzzle);
    const request = new Request({controller, action: 'succeed'});

    controllerMock.succeed.returns('foobar');
    pluginGetControllersStub = kuzzle.ask
      .withArgs(pluginGetControllersEvent)
      .resolves(new Map([
        [controller, controllerMock]
      ]));

    return should(funnel.processRequest(request))
      .rejectedWith(
        PluginImplementationError,
        {id: 'plugin.controller.invalid_action_response'})
      .then(() => {
        should(pluginGetControllersStub).be.calledWith(pluginGetControllersEvent);
        should(kuzzle.pipe).not.calledWith('request:onSuccess', request);
        should(kuzzle.pipe).calledWith('request:onError', request);
        should(kuzzle.pipe).calledWith(`${controller}:errorSucceed`, request);
        should(kuzzle.statistics.startRequest).be.called();
      });
  });

  it('should reject if _checkSdkVersion fail', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'succeed'
    });
    funnel._checkSdkVersion = sinon.stub().rejects(new Error('incompatible sdk'));

    return should(funnel.processRequest(request))
      .be.rejectedWith(Error, { message: 'Caught an unexpected plugin error: incompatible sdk\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.' });
  });

  it('should throw if a plugin action returns a non-serializable response', () => {
    const controller = 'fakePlugin/controller';
    const controllerMock = new MockBaseController(kuzzle);
    const request = new Request({controller, action: 'succeed'});
    const unserializable = {};

    unserializable.self = unserializable;
    controllerMock.succeed.resolves(unserializable);
    pluginGetControllersStub = kuzzle.ask
      .withArgs(pluginGetControllersEvent)
      .resolves(new Map([
        [controller, controllerMock]
      ]));

    return funnel.processRequest(request)
      .then(() => { throw new Error('Expected test to fail'); })
      .catch(e => {
        should(pluginGetControllersStub).be.calledWith(pluginGetControllersEvent);
        should(e).be.an.instanceOf(PluginImplementationError);
        should(e.id).eql('plugin.controller.unserializable_response');
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

  it('should wrap a Node error on a plugin action failure', async () => {
    const controller = 'fakePlugin/controller';
    const request = new Request({controller, action: 'fail'});
    const controllerMock = new MockBaseController(kuzzle);

    controllerMock.fail.rejects(new Error('foobar'));
    pluginGetControllersStub = kuzzle.ask
      .withArgs(pluginGetControllersEvent)
      .resolves(new Map([
        [controller, controllerMock]
      ]));

    await should(funnel.processRequest(request))
      .rejectedWith(PluginImplementationError, {
        id: 'plugin.runtime.unexpected_error',
        message: /Caught an unexpected plugin error: foobar.*/,
      });

    should(kuzzle.pipe).calledWith(`${controller}:beforeFail`);
    should(kuzzle.pipe).not.be.calledWith(`${controller}:afterFail`);
    should(kuzzle.pipe).not.calledWith('request:onSuccess', request);
    should(kuzzle.pipe).calledWith('request:onError', request);
    should(kuzzle.pipe).calledWith('fakePlugin/controller:errorFail', request);
    should(kuzzle.statistics.startRequest).be.called();
    should(kuzzle.statistics.completedRequest).not.be.called();
    should(kuzzle.statistics.failedRequest).be.called();
  });

  it('should update the query documents with alias pipe', async () => {
    kuzzle.pipe.restore();
    kuzzle.ask.withArgs('core:storage:public:document:create').resolves({
      _id: 'foobar',
      _source: 'src',
    });

    const plugin = {
      instance: {
        init: () => {},
        pipes: {
          'generic:document:beforeWrite': async function hello(documents) {
            should(documents[0]._id).equal(null);

            documents[0]._id = 'foobar';

            return documents;
          },
          'document:beforeCreate': async (request) => {
            should(request.input.resource._id).equal('foobar');
            return request;
          },
        },
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    };
    pluginsManager._plugins.set(plugin);

    const request = new Request({
      controller: 'document',
      action: 'create',
      index: 'foo',
      collection: 'bar',
      body: {
        foo: 'bar',
      }
    });

    pluginsManager._initPipes(plugin);

    return funnel.processRequest(request);
  });

  describe('_checkSdkVersion', () => {
    let request;

    beforeEach(() => {
      request = {
        input: {
          volatile: {}
        }
      };
    });

    it('should not throw if sdkName is in incorrect format', () => {
      request.input.volatile.sdkName = {};
      should(() => funnel._checkSdkVersion(request)).not.throw();

      request.input.volatile.sdkName = '';
      should(() => funnel._checkSdkVersion(request)).not.throw();

      request.input.volatile.sdkName = 'js#7.4.3';
      should(() => funnel._checkSdkVersion(request)).not.throw();

      request.input.volatile.sdkName = 'js@';
      should(() => funnel._checkSdkVersion(request)).not.throw();

      request.input.volatile.sdkName = '@7.4.3';
      should(() => funnel._checkSdkVersion(request)).not.throw();
    });

    it('should not throw if the SDK version is unknown', () => {
      funnel.sdkCompatibility = { js: { min: 7 } };

      request.input.volatile.sdkName = 'csharp@8.4.2';

      should(funnel._checkSdkVersion(request)).not.throw();
    });

    it('should not throw if the SDK version is compatible', () => {
      funnel.sdkCompatibility = { js: { min: 6 } };

      request.input.volatile.sdkName = 'js@6.4.2';

      should(funnel._checkSdkVersion(request)).not.throw();
    });

    it('should throw an error if the SDK version is not compatible', () => {
      funnel.sdkCompatibility = { js: { min: 8 } };

      request.input.volatile.sdkName = 'js@7.4.2';

      should(() => funnel._checkSdkVersion(request))
        .throw(BadRequestError, { id: 'api.process.incompatible_sdk_version' });
    });

    it('should throw an error if a sdkVersion property from v1 SDKs is present', () => {
      request.input.volatile.sdkVersion = '7.4.2';

      should(() => funnel._checkSdkVersion(request))
        .throw(BadRequestError, { id: 'api.process.incompatible_sdk_version' });
    });
  });
});
