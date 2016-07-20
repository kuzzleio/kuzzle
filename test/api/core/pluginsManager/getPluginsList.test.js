var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

require('sinon-as-promised')(Promise);

describe('Plugins manager: getPluginsList', function () {
  var 
    getPluginsList,
    sandbox,
    kuzzle;

  before(() => {
    getPluginsList = PluginsManager.__get__('getPluginsList');

    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
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