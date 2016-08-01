var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

describe('Plugins manager: getPluginsList', () => {
  var
    getPluginsList,
    kuzzle;

  before(() => {
    getPluginsList = PluginsManager.__get__('getPluginsList');
    kuzzle = new Kuzzle();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should not return any plugin if the database search returns nothing', () => {
    sandbox.stub(kuzzle.internalEngine, 'search').resolves({hits: []});

    return getPluginsList(kuzzle, true)
      .then(plugins => should(plugins).be.an.Object().and.be.empty());
  });

  it('should return a properly formatted plugins list', () => {
    sandbox.stub(kuzzle.internalEngine, 'search').resolves({hits: [
      {'_id': 'foo', _source: { config: {}}},
      {'_id': 'bar', _source: { config: {}}},
      {'_id': 'foobar', _source: { config: {}}}
    ]});

    return getPluginsList(kuzzle, true)
      .then(plugins => {
        should(plugins).be.an.Object().and.not.be.empty();
        should(plugins).have.properties(['foo', 'bar', 'foobar']);
        should(plugins.foo).have.property('config').and.not.have.property('_source');
        should(plugins.bar).have.property('config').and.not.have.property('_source');
        should(plugins.foobar).have.property('config').and.not.have.property('_source');
      });
  });

  it('should only return server plugins on a server instance', () => {
    sandbox.stub(kuzzle.internalEngine, 'search').resolves({hits: [
      {'_id': 'foo', _source: { config: { 'loadedBy': 'server' }}},
      {'_id': 'bar', _source: { config: { 'loadedBy': 'worker' }}},
      {'_id': 'foobar', _source: { config: { 'loadedBy': 'all' }}}
    ]});

    return getPluginsList(kuzzle, true)
      .then(plugins => {
        should(plugins).be.an.Object().and.not.be.empty();
        should(plugins).have.properties(['foo', 'foobar']).and.not.have.property('bar');
        should(plugins.foo).have.property('config').and.not.have.property('_source');
        should(plugins.foobar).have.property('config').and.not.have.property('_source');
      });
  });

  it('should only return worker plugins on a worker instance', () => {
    sandbox.stub(kuzzle.internalEngine, 'search').resolves({hits: [
      {'_id': 'foo', _source: { config: { 'loadedBy': 'server' }}},
      {'_id': 'bar', _source: { config: { 'loadedBy': 'worker' }}},
      {'_id': 'foobar', _source: { config: { 'loadedBy': 'all' }}}
    ]});

    return getPluginsList(kuzzle, false)
      .then(plugins => {
        should(plugins).be.an.Object().and.not.be.empty();
        should(plugins).have.properties(['bar', 'foobar']).and.not.have.property('foo');
        should(plugins.bar).have.property('config').and.not.have.property('_source');
        should(plugins.foobar).have.property('config').and.not.have.property('_source');
      });
  });
});