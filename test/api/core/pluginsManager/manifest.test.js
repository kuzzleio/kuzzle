const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  mockrequire = require('mock-require'),
  AbstractManifest = require('../../../../lib/api/core/abstractManifest'),
  { errors: { PluginImplementationError } } = require('kuzzle-common-objects');

class AbstractManifestStub extends AbstractManifest {
  load() {}
}

describe('Plugins manifest class', () => {
  const
    fsStub = {
      accessSync: sinon.stub(),
      constants: {
        R_OK: true
      }
    },
    pluginPath = 'foo/bar';
  let
    kuzzle,
    Manifest;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    mockrequire('../../../../lib/api/core/abstractManifest', AbstractManifestStub);
    mockrequire.reRequire('../../../../lib/api/core/abstractManifest');
    Manifest = rewire('../../../../lib/api/core/plugins/pluginManifest');
    Manifest.__set__({ fs: fsStub });
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
