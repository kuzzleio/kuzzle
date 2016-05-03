var
  q = require('q'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

require('sinon-as-promised')(q.Promise);

describe('PluginsManager: init()', () => {
  var
    kuzzle,
    sandbox,
    engineMock,
    pluginsManager;

  before(() => {
    kuzzle = {
      config: {
        pluginsManager: {}
      },
      internalEngine: {}
    };

    pluginsManager = new PluginsManager(kuzzle);
  });

  beforeEach(() => {
    kuzzle.internalEngine.search = sinon.expectation.create('search');
  });


  it('should do nothing if isDummy is set to true', () => {
    kuzzle.internalEngine.search.never();

    return pluginsManager.init(true, true)
      .then(() => kuzzle.internalEngine.search.verify());
  });

  it('should set isDummy to false if the dummy argument is undefined', () => {
    kuzzle.internalEngine.search.once().resolves({hits: []});

    return pluginsManager.init(true)
      .then(() => kuzzle.internalEngine.search.verify());
  });
});