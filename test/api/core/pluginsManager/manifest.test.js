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
    Manifest = rewire('../../../../lib/api/core/plugins/manifest');
    Manifest.__set__({ fs: fsStub });
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  // @deprecated
  describe('#fallback (DEPRECATED)', () => {
    beforeEach(() => {
      fsStub.accessSync.throws(new Error('foobar'));
    });

    afterEach(() => {
      fsStub.accessSync.reset();
    });

    it('should fallback to package.json if there is no manifest.json file available', () => {
      const
        manifest = new Manifest(kuzzle, pluginPath),
        packagejson = {name: 'foo'};

      Manifest.__with__('require', m => {
        return m.endsWith(`${pluginPath}/package.json`) ? packagejson : require(m);
      })(() => {
        manifest.load();
        should(kuzzle.log.warn)
          .calledOnce()
          .calledWith(`[${pluginPath}] Plugins without a manifest.json file are deprecated.`);

        should(manifest.name).eql('foo');
      });
    });

    it('should throw if no package.json file can be found', () => {
      const
        manifest = new Manifest(kuzzle, pluginPath);

      Manifest.__with__('require', m => {
        if (m.endsWith(`${pluginPath}/package.json`)) {
          throw new Error('foobar');
        }
        return require(m);
      })(() => {
        should(() => manifest.load()).throw(PluginImplementationError, {
          errorName: 'plugin.manifest.missing_package'
        });
      });
    });

    it('should throw if no valid name property can be found', () => {
      const
        manifest = new Manifest(kuzzle, pluginPath),
        packagejson = {};

      Manifest.__with__('require', m => {
        return m.endsWith(`${pluginPath}/package.json`) ? packagejson : require(m);
      })(() => {
        for (const name of ['', null, 123]) {
          packagejson.name = name;
          should(() => manifest.load()).throw(PluginImplementationError, {
            errorName: 'plugin.manifest.missing_package_name'
          });
        }
      });
    });

    it('should lowercase a name coming from the package.json file', () => {
      const
        manifest = new Manifest(kuzzle, pluginPath),
        packagejson = {name: 'fOoBaR'};

      Manifest.__with__('require', m => {
        return m.endsWith(`${pluginPath}/package.json`) ? packagejson : require(m);
      })(() => {
        manifest.load();
        should(kuzzle.log.warn)
          .calledOnce()
          .calledWith(`[${pluginPath}] Plugins without a manifest.json file are deprecated.`);

        should(manifest.name).eql('foobar');
      });
    });
  });

  it('should throw if the provided name contains invalid characters', () => {
    const
      manifest = new Manifest(kuzzle, pluginPath);

    for (const name of ['foo$Bar', 'foobâr', 'foobar!']) {
      manifest.name = name;
      should(() => manifest.load())
        .throw(PluginImplementationError, {
          errorName: 'plugin.manifest.invalid_name'
        });
    }
  });


  it('should throw if an invalid privileged value is provided', () => {
    const
      manifest = new Manifest(kuzzle, pluginPath);

    manifest.raw = {privileged: 123};
    should(() => manifest.load()).throw(PluginImplementationError, {
      errorName: 'plugin.manifest.invalid_privileged'
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
