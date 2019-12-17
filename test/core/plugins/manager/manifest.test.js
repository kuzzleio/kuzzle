'use strict';

const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  mockrequire = require('mock-require'),
  AbstractManifest = require('../../../../lib/core/abstractManifest'),
  { errors: { PluginImplementationError } } = require('kuzzle-common-objects');

class AbstractManifestStub extends AbstractManifest {
  load() {}
}

describe('Plugins manifest class', () => {
  const
    pluginPath = 'foo/bar';
  let
    kuzzle,
    Manifest;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    mockrequire('../../../../lib/core/abstractManifest', AbstractManifestStub);
    Manifest = mockrequire.reRequire('../../../../lib/core/plugins/manifest');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should throw if the provided name contains invalid characters', () => {
    const
      manifest = new Manifest(kuzzle, pluginPath);

    for (const name of ['foo$Bar', 'foobâr', 'foobar!']) {
      manifest.name = name;
      should(() => manifest.load())
        .throw(PluginImplementationError, {
          id: 'plugin.manifest.invalid_name'
        });
    }
  });

  it('should throw if an invalid privileged value is provided', () => {
    const
      manifest = new Manifest(kuzzle, pluginPath);

    manifest.raw = {privileged: 123};
    should(() => manifest.load()).throw(PluginImplementationError, {
      id: 'plugin.manifest.invalid_privileged'
    });
  });

  it('should properly set its privileged value according to the manifest.json one', () => {
    const manifest = new Manifest(kuzzle, pluginPath);

    should(manifest.privileged).be.false();
    manifest.raw = {privileged: true};
    manifest.load();

    should(manifest.privileged).be.true();
  });
});
