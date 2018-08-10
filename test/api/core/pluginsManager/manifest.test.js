const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  { PluginImplementationError } = require('kuzzle-common-objects').errors;

const manifestFilePath = '../../../../lib/api/core/plugins/manifest';

describe('Manifest class', () => {
  const
    kuzzle = new KuzzleMock(),
    consoleStub = { warn: sinon.stub() },
    fallback = sinon.stub(),
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
    Manifest = rewire(manifestFilePath);
    Manifest.__set__({ console: consoleStub });
  });

  afterEach(() => {
    consoleStub.warn.resetHistory();
    fallback.resetHistory();
  });

  // @deprecated - title must be updated once fallbacks are removed
  it('should throw if no manifest.json is found, and if no fallback is defined', () => {
    const message = new RegExp(`Cannot find module '.*?${pluginPath}/manifest\\.json'`);
    should(() => new Manifest(kuzzle, pluginPath))
      .throw(PluginImplementationError, {message});
  });

  // @deprecated
  it('should use the provided fallback and warn that fallbacks are deprecated', () => {
    fallback.callsFake(m => { m.name = 'foobar'; });

    const manifest = new Manifest(kuzzle, pluginPath, fallback);

    should(fallback).calledOnce().calledWith(manifest);
    should(consoleStub.warn)
      .calledOnce()
      .calledWith(`[${pluginPath}] Plugins without a manifest.json file are deprecated.`);
    should(manifest).match({
      name: 'foobar',
      privileged: false,
      path: pluginPath,
      kuzzleVersion: defaultKuzzleVersion
    });
  });

  it('should throw if an invalid privileged value is provided', () => {
    const message = new RegExp(`\\[.*?${pluginPath}/manifest\\.json\\] Invalid "privileged" property: expected a boolean, got a number`);
    mockRequireManifest({name: 'foobar', privileged: 123})(() => {
      should(() =>new Manifest(kuzzle, 'foo/bar', fallback))
        .throw(PluginImplementationError, {message});
    });
  });

  it('should properly set its privileged value according to the manifest.json one', () => {
    mockRequireManifest({name: 'foobar', privileged: true})(() => {
      const manifest = new Manifest(kuzzle, pluginPath);
      should(manifest).match({
        name: 'foobar',
        kuzzleVersion: defaultKuzzleVersion,
        privileged: true,
        path: pluginPath
      });
    });
  });

  it('should throw if kuzzleVersion is not a string', () => {
    const message = new RegExp(`\\[${pluginPath}/manifest.json\\] Invalid "kuzzleVersion" property: expected a non-empty string`);
    mockRequireManifest({name: 'foobar', kuzzleVersion: 123})(() => {
      should(() => new Manifest(kuzzle, pluginPath))
        .throw(PluginImplementationError, {message});
    });
  });

  it('should complain and default the Kuzzle target version to 1.x if no kuzzleVersion property is found', () => {
    mockRequireManifest({name: 'foobar'})(() => {
      const manifest = new Manifest(kuzzle, pluginPath);
      should(consoleStub.warn)
        .calledOnce()
        .calledWith(`[${pluginPath}/manifest.json] No "kuzzleVersion" property found: assuming the target is Kuzzle v1`);
      should(manifest).match({
        name: 'foobar',
        kuzzleVersion: defaultKuzzleVersion
      });
    });
  });

  it('should set the provided kuzzleVersion value', () => {
    const kuzzleVersion = '>1.0.0 <=99.99.99';
    mockRequireManifest({name: 'foobar', kuzzleVersion})(() => {
      const manifest = new Manifest(kuzzle, pluginPath);
      should(manifest).match({name: 'foobar', kuzzleVersion});
    });
  });

  it('should throw if the provided name is not a non-empty string', () => {
    const message = new RegExp(`\\[${pluginPath}/manifest.json\\] Invalid "name" property: expected a non-empty string`);

    [123, false, ''].forEach(name => {
      mockRequireManifest({name})(() => {
        should(() => new Manifest(kuzzle, pluginPath))
          .throw(PluginImplementationError, {message});
      });
    });
  });

  it('should throw if the provided name contains invalid characters', () => {
    const message = new RegExp(`\\[${pluginPath}/manifest.json\\] Invalid plugin name. The name must be comprised only of lowercased letters, numbers, hyphens and underscores`);
    ['fooBar', 'foobâr', 'foobar!'].forEach(name => {
      mockRequireManifest({name})(() => {
        should(() => new Manifest(kuzzle, pluginPath))
          .throw(PluginImplementationError, {message});
      });
    });
  });

  it('should throw if no name property is provided', () => {
    const message = new RegExp(`\\[${pluginPath}/manifest.json\\] A "name" property is required"`);

    [undefined, null].forEach(name => {
      mockRequireManifest({name})(() => {
        should(() => new Manifest(kuzzle, pluginPath))
          .throw(PluginImplementationError, {message});
      });
    });
  });

  it('should use the provided name if it is valid', () => {
    ['foobar', 'foo-bar', '42fo-o-b_a_a_r-', '__foobar__'].forEach(name => {
      mockRequireManifest({name})(() => {
        should(new Manifest(kuzzle, pluginPath)).match({name});
      });
    });
  });

  it('should throw if kuzzleVersion does not match the current Kuzzle version', () => {
    const kuzzleVersion = '>0.4.2 <1.0.0';
    const message = new RegExp(`\\[${pluginPath}/manifest.json\\] Version mismatch: current Kuzzle version ${kuzzle.config.version} does not match the plugin requirements \\(${kuzzleVersion}\\)`);
    mockRequireManifest({name: 'foobar', kuzzleVersion})(() => {
      should(() => new Manifest(kuzzle, pluginPath))
        .throw(PluginImplementationError, {message});
    });
  });
});
