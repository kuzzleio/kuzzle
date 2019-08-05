const
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  rewire = require('rewire'),
  { errors: { PluginImplementationError } } = require('kuzzle-common-objects');

describe('AbstractManifest class', () => {
  const
    kuzzle = new KuzzleMock(),
    pluginPath = 'foo/bar',
    defaultKuzzleVersion = '>=1.0.0 <2.0.0';
  let Manifest;

  function mockRequireManifest(manifest) {
    return Manifest.__with__('require', m => {
      if (m.endsWith(`${pluginPath}/manifest.json`)) {
        return manifest;
      }
      return require(m);
    });
  }

  beforeEach(() => {
    Manifest = rewire('../../../lib/api/core/abstractManifest');
  });

  it('should throw if no manifest.json is found', () => {
    const
      message = new RegExp(`\\[${pluginPath}\\] Unable to load the file 'manifest.json`),
      manifest = new Manifest(kuzzle, pluginPath);

    should(() => manifest.load()).throw(PluginImplementationError, { message });
  });

  it('should throw if kuzzleVersion is not a string', () => {
    const message = new RegExp(`\\[${pluginPath}/manifest.json\\] Version mismatch: current Kuzzle version ${kuzzle.config.version} does not match the manifest requirements \\(123\\)`),
      manifest = new Manifest(kuzzle, pluginPath);

    mockRequireManifest({ name: 'foobar', kuzzleVersion: 123 })(() => {
      should(() => manifest.load())
        .throw(PluginImplementationError, { message });
    });
  });

  it('should complain and default the Kuzzle target version to v1 if no kuzzleVersion property is found', () => {
    mockRequireManifest({ name: 'foobar' })(() => {
      const manifest = new Manifest(kuzzle, pluginPath);
      manifest.load();
      should(kuzzle.log.warn)
        .calledOnce()
        .calledWith(`[${pluginPath}/manifest.json] No "kuzzleVersion" property found: assuming the target is Kuzzle v1`);
      should(manifest).match({
        name: 'foobar',
        kuzzleVersion: defaultKuzzleVersion
      });
    });
  });

  it('should set the provided kuzzleVersion value', () => {
    const
      kuzzleVersion = '>1.0.0 <=99.99.99',
      manifest = new Manifest(kuzzle, pluginPath);

    mockRequireManifest({ name: 'foobar', kuzzleVersion })(() => {
      manifest.load();
      should(manifest).match({ name: 'foobar', kuzzleVersion });
    });
  });

  it('should throw if the provided name is not a non-empty string', () => {
    const
      message = new RegExp(`\\[${pluginPath}/manifest.json\\] Invalid "name" property: expected a non-empty string`),
      manifest = new Manifest(kuzzle, pluginPath);

    [123, false, ''].forEach(name => {
      mockRequireManifest({ name })(() => {
        should(() => manifest.load()).throw(PluginImplementationError, { message });
      });
    });
  });

  it('should throw if no name property is provided', () => {
    const
      message = new RegExp(`\\[${pluginPath}/manifest.json\\] A "name" property is required.`),
      manifest = new Manifest(kuzzle, pluginPath);

    [undefined, null].forEach(name => {
      mockRequireManifest({ name })(() => {
        should(() => manifest.load()).throw(PluginImplementationError, { message });
      });
    });
  });

  it('should throw if kuzzleVersion does not match the current Kuzzle version', () => {
    const
      kuzzleVersion = '>0.4.2 <1.0.0',
      message = new RegExp(`\\[${pluginPath}/manifest.json\\] Version mismatch: current Kuzzle version ${kuzzle.config.version} does not match the manifest requirements \\(${kuzzleVersion}\\)`),
      manifest = new Manifest(kuzzle, pluginPath);

    mockRequireManifest({ name: 'foobar', kuzzleVersion })(() => {
      should(() => manifest.load()).throw(PluginImplementationError, { message });
    });
  });

  it('should serialize only the necessary properties', () => {
    const manifest = new Manifest(kuzzle, pluginPath);

    mockRequireManifest({ name: 'foobar' })(() => {
      manifest.load();

      const serialized = JSON.parse(JSON.stringify(manifest));

      should(serialized).eql({
        name: manifest.name,
        path: manifest.path,
        kuzzleVersion: manifest.kuzzleVersion
      });
    });
  });
});
