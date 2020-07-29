'use strict';

const should = require('should');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const mockrequire = require('mock-require');
const AbstractManifest = require('../../../lib/core/shared/abstractManifest');
const { errors: { PluginImplementationError } } = require('kuzzle-common-objects');

class AbstractManifestStub extends AbstractManifest {
  loadFromDisk() {}
}

describe('Plugins manifest class', () => {
  const pluginPath = 'foo/bar';
  let kuzzle;
  let Manifest;
  let manifest;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    mockrequire('../../../lib/core/shared/abstractManifest', AbstractManifestStub);
    Manifest = mockrequire.reRequire('../../../lib/core/plugin/pluginManifest');
    manifest = new Manifest(kuzzle, pluginPath);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should throw if the provided name contains invalid characters', () => {
    for (const name of ['foo$Bar', 'foobâr', 'foobar!']) {
      manifest.name = name;

      /* eslint-disable-next-line no-loop-func */
      should(() => manifest.load())
        .throw(PluginImplementationError, {
          id: 'plugin.manifest.invalid_name'
        });
    }
  });

  it('should throw if an invalid privileged value is provided', () => {
    manifest.raw = {privileged: 123};
    should(() => manifest.load()).throw(PluginImplementationError, {
      id: 'plugin.manifest.invalid_privileged'
    });
  });

  it('should properly set its privileged value according to the manifest.json one', () => {
    should(manifest.privileged).be.false();
    manifest.raw = {privileged: true};
    manifest.load();

    should(manifest.privileged).be.true();
  });
});
