var
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  rewire = require('rewire'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  PluginPackage = rewire('../../../../../lib/api/core/plugins/packages/pluginPackage');

describe('plugins/packages/pluginPackage', () => {
  var
    kuzzle,
    pkg;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    pkg = new PluginPackage(kuzzle, 'plugin', {});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('should do its job', () => {
      var
        def = {foo: 'bar'};

      sandbox.stub(PluginPackage.prototype, 'setDefinition');

      pkg = new PluginPackage(kuzzle, 'plugin', def);

      should(pkg).be.an.instanceOf(PluginPackage);
      should(pkg.name).be.exactly('plugin');
      should(PluginPackage.prototype.setDefinition)
        .be.calledOnce()
        .be.calledWithExactly(def);
    });
  });

  describe('#setDefinition', () => {
    it('should populate the object attributes', () => {
      pkg.setDefinition({
        path: 'path',
        gitUrl: 'will be overridden',
        url: 'url',
        npmVersion: 'will be overridden',
        version: 'version',
        activated: 'activated',
        foo: 'bar'
      });

      should(pkg).not.have.property('foo');
      should(pkg.path).be.exactly('path');
      should(pkg).not.have.property('gitUrl');
      should(pkg.url).be.exactly('url');
      should(pkg).not.have.property('npmVersion');
      should(pkg.version).be.exactly('version');
      should(pkg.activated).be.exactly('activated');
    });
  });

  describe('#dbConfiguration', () => {
    it('should return the configuration stored in ES', () => {
      kuzzle.internalEngine.get.resolves({
        _id: 'plugin',
        _source: {
          version: 'version',
          npmVersion: 'not used',
          url: 'url',
          gitUrl: 'not used'
        }
      });

      return pkg.dbConfiguration()
        .then(config => {
          should(config).match({
            version: 'version',
            url: 'url'
          });
          should(config).not.have.property('gitUrl');
          should(config).not.have.property('npmVersion');
        });
    });

    it('should be back compatible with npmVersion and gitUrl notations', () => {
      kuzzle.internalEngine.get.resolves({
        _id: 'plugin',
        _source: {
          npmVersion: 'npmVersion',
          gitUrl: 'gitUrl'
        }
      });

      return pkg.dbConfiguration()
        .then(config => {
          should(config).match({
            version: 'npmVersion',
            url: 'gitUrl'
          });
        });
    });
  });

  describe('#updateDbConfiguration', () => {
    it('should write the given config to ES', () => {
      var config = {
        foo: 'bar'
      };

      kuzzle.internalEngine.createOrReplace.resolves({
        _id: 'id',
        _source: 'source'
      });

      return pkg.updateDbConfiguration(config)
        .then(response => {
          should(response).be.exactly('source');
          should(kuzzle.internalEngine.createOrReplace)
            .be.calledOnce()
            .be.calledWithMatch('plugins', pkg.name, {
              version: pkg.version,
              activated: pkg.activated,
              config
            });
        });
    });
  });

  describe('#setActivate', () => {
    it('should toggle the activation status in ES', () => {
      pkg.dbConfiguration = sandbox.stub().resolves({
        config: 'config'
      });
      pkg.updateDbConfiguration = sandbox.stub().resolves('OK');

      return pkg.setActivate('activated')
        .then(response => {
          should(response).be.exactly('OK');

          should(pkg.dbConfiguration)
            .be.calledOnce();

          should(pkg.updateDbConfiguration)
            .be.calledOnce()
            .be.calledWithExactly('config');

          should(pkg.activated).be.exactly('activated');
        });
    });

    it('should do nothing if the packaged is marked as deleted', () => {
      pkg.dbConfiguration = sandbox.stub().resolves({
        deleted: true
      });
      pkg.updateDbConfiguration = sinon.stub();

      return pkg.setActivate('activated')
        .then(response => {
          should(response).match({deleted: true});
          should(pkg.updateDbConfiguration).have.callCount(0);
        });
    });
  });

  describe('#localConfiguration', () => {
    it('should read the local configuration and merge it with kuzzle s one', () => {
      kuzzle.config.plugins.plugin = {
        config: {
          bar: 'baz'
        }
      };

      return PluginPackage.__with__({
        require: () => {
          return {
            pluginInfo: {
              defaultConfig: {
                foo: 'bar'
              }
            }
          };
        }
      })(() => {
        var result = pkg.localConfiguration();

        should(result).match({
          foo: 'bar',
          bar: 'baz'
        });
      });
    });
  });

  describe('#isInstalled', () => {
    it('should return true if a local configuration is found', () => {
      return PluginPackage.__with__({
        require: () => true
      })(() => {
        var result = pkg.isInstalled();

        should(result).be.true();
      });
    });

    it('should return false if no local configuration is found', () => {
      return PluginPackage.__with__({
        require: () => { throw new Error('error'); }
      })(() => {
        var result = pkg.isInstalled();

        should(result).be.false();
      });
    });
  });

  describe('#needsInstall', () => {
    it('should return true if the plugin package is not installed', () => {
      pkg.isInstalled = sinon.stub().returns(false);
      pkg.dbConfiguration = sinon.stub();

      return pkg.needsInstall()
        .then(result => {
          should(result).be.true();
          should(pkg.dbConfiguration)
            .have.callCount(0);
        });
    });

    it('should return true if no configuration is found in db', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().rejects(new Error('Not Found'));

      return pkg.needsInstall()
        .then(result => {
          should(result).be.true();
        });
    });

    it('should return true if no version is found in the configuration from db', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().resolves({});

      return pkg.needsInstall()
        .then(result => {
          should(result).be.true();
        });
    });

    it('should reject the promise if some unexpected error occurred', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().rejects(new Error('unexpected'));

      return should(pkg.needsInstall()).be.rejectedWith('unexpected');
    });

    it('should return fails if the package is marked as deleted', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().resolves({deleted: true});

      return pkg.needsInstall()
        .then(result => {
          should(result).be.false();
        });
    });

    it('should rely on compareVersion to get the result', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().resolves({
        version: 'db version'
      });
      pkg.localVersion = sinon.stub().returns('local version');

      return PluginPackage.__with__({
        compareVersions: sinon.stub().returns(-42)
      })(() => {
        return pkg.needsInstall()
          .then(result => {
            should(result).be.false();

            should(PluginPackage.__get__('compareVersions'))
              .be.calledOnce()
              .be.calledWithExactly('db version', 'local version');
          });
      });
    });
  });

  describe('#needsToBeDeleted', () => {
    it('should immediately return fals if the plugin is not installed', () => {
      pkg.isInstalled = sinon.stub().returns(false);
      pkg.dbConfiguration = sinon.stub();

      return pkg.needsToBeDeleted()
        .then(result => {
          should(result).be.false();
          should(pkg.dbConfiguration).have.callCount(0);
        });
    });

    it('should return false if no db configuration was found', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().rejects(new Error('Not Found'));

      return pkg.needsToBeDeleted()
        .then(result => {
          should(result).be.false();
        });
    });

    it('should reject the promise if some unexpected error occurred', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().rejects(new Error('unexpected'));

      return should(pkg.needsToBeDeleted())
        .be.rejectedWith('unexpected');
    });

    it('should return the deleted flag from the db', () => {
      pkg.isInstalled = sinon.stub().returns(true);
      pkg.dbConfiguration = sinon.stub().resolves({
        deleted: 0
      });

      return pkg.needsToBeDeleted()
        .then(result => {
          should(result).be.false();
        });
    });
  });

  describe('#loccalVersion', () => {
    it('should return the version from local package', () => {
      return PluginPackage.__with__({
        require: () => {
          return {
            version: 'version'
          };
        }
      })(() => {
        var result = pkg.localVersion();

        should(result).be.exactly('version');
      });
    });
  });

  describe('#install', () => {
    var
      exec,
      reset;

    beforeEach(() => {
      pkg.localVersion = sinon.stub().returns('local version');
      pkg.localConfiguration = sinon.stub().returns('local configuration');
      pkg.updateDbConfiguration = sinon.stub().resolves();

      exec = sinon.stub().yields(undefined, 'plugin@1.0.0 node_modules/plugin\n' +
        '├── lodash.create@3.1.1 (lodash._isiterateecall@3.0.9, lodash._basecreate@3.0.3, lodash._baseassign@3.2.0)\n' +
        '└── glob@7.0.5 (path-is-absolute@1.0.1, inherits@2.0.3, fs.realpath@1.0.0, minimatch@3.0.3, once@1.4.0, inflight@1.0.6)\n');
      reset = PluginPackage.__set__({
        exec
      });
    });

    afterEach(() => {
      reset();
    });

    it('should allow installing a package from npm repos', () => {
      return pkg.install()
        .then(() => {
          should(exec)
            .be.calledOnce()
            .be.calledWith('npm install plugin');

          should(pkg.updateDbConfiguration)
            .be.calledOnce();
        });
    });

    it('should install a package from a local path', () => {
      pkg.path = '/some/path';

      return pkg.install()
        .then(() => {
          should(exec)
            .be.calledOnce()
            .be.calledWith('npm install /some/path');

          should(pkg.updateDbConfiguration)
            .be.calledOnce()
            .be.calledWith('local configuration');
        });
    });

    it('should install a package from an url', () => {
      pkg.path = '/some/path';
      pkg.url = 'http://some.url';

      return pkg.install()
        .then(() => {
          should(exec)
            .be.calledOnce()
            .be.calledWith('npm install http://some.url');
        });
    });

    it('should allow setting a version', () => {
      pkg.version = 'version';

      return pkg.install()
        .then(() => {
          should(exec)
            .be.calledOnce()
            .be.calledWith('npm install plugin@version');
        });
    });

    it('should deal with commitish versions', () => {
      pkg.url = 'https://github.com/some/repo.git';
      pkg.version = 'version';

      return pkg.install()
        .then(() => {
          should(exec)
            .be.calledOnce()
            .be.calledWith('npm install https://github.com/some/repo.git#version');
        });
    });

    it('should not add the version if we install a package from a remote tar', () => {
      pkg.url = 'http://some/tar.gz';
      pkg.version = 'version';

      return pkg.install()
        .then(() => {
          should(exec)
            .be.calledOnce()
            .be.calledWith('npm install http://some/tar.gz');
        });
    });

    it('should reject the promise if npm failed', () => {
      var error = new Error('error');

      return PluginPackage.__with__({
        exec: sinon.stub().yields(error)
      })(() => {
        return should(pkg.install())
          .be.rejectedWith(error);
      });
    });

    it('should get the name and the version from npm install output and send a warning if the given name does not match', () => {
      pkg.name = 'invalid';

      return PluginPackage.__with__({
        console: {
          warn: sinon.spy()
        }
      })(() => {
        return pkg.install()
          .then(() => {
            should(exec)
              .be.calledOnce()
              .be.calledWith('npm install invalid');

            should(PluginPackage.__get__('console.warn'))
              .be.calledOnce()
              .be.calledWith('WARNING: Given plugin name "invalid" does not match its packages.json name "plugin".\n' +
                'If you installed this plugin by other means than the CLI, please update Kuzzle configuration to use proper name "plugin".');

            should(pkg.name).be.exactly('plugin');
            should(pkg.version).be.exactly('1.0.0');
          });
      });
    });

    it('should get the name and the version and if not match, reject the promise if the plugins manager is init', () => {
      pkg.name = 'invalid';
      kuzzle.pluginsManager.isInit = true;

      return should(pkg.install())
        .be.rejectedWith(BadRequestError, {
          message: 'WARNING: Given plugin name "invalid" does not match its packages.json name "plugin".\n' +
          'If you installed this plugin by other means than the CLI, please update Kuzzle configuration to use proper name "plugin".'
        });
    });
  });

  describe('#delete', () => {
    it('should mark the package as deleted and remove the local installation dir', () => {
      return PluginPackage.__with__({
        rimraf: sinon.stub().yields()
      })(() => {
        return pkg.delete()
          .then(() => {
            should(kuzzle.internalEngine.createOrReplace)
              .be.calledOnce()
              .be.calledWithMatch('plugins', pkg.name, {deleted: true});

            should(PluginPackage.__get__('rimraf'))
              .be.calledOnce()
              .be.calledWith(`${kuzzle.rootPath}/node_modules/${pkg.name}`);

            should(pkg.deleted).be.true();
          });
      });
    });
  });

  describe('#setConfigurationProperty', () => {
    it('should update the configuration in ES' , () => {
      pkg.dbConfiguration = sinon.stub().resolves({
        config: {
          foo: 'bar'
        }
      });
      pkg.updateDbConfiguration = sinon.stub().resolves({ _source: 'ok' });

      return pkg.setConfigurationProperty({
        bar: 'baz'
      })
        .then(() => {
          should(pkg.updateDbConfiguration)
            .be.calledOnce()
            .be.calledWithMatch({
              foo: 'bar',
              bar: 'baz'
            });
        });
    });

    it('should do nothing if the plugin package is marked for deletion', () => {
      pkg.dbConfiguration = sinon.stub().resolves({ deleted: true });
      pkg.updateDbConfiguration = sinon.spy();

      return pkg.setConfigurationProperty({
        foo: 'bar'
      })
        .then(response => {
          should(response).match({
            deleted: true
          });
          should(pkg.updateDbConfiguration)
            .have.callCount(0);
        });
    });
  });

  describe('#unsetConfigurationProperty', () => {
    it('should update the configuration in db', () => {
      pkg.dbConfiguration = sinon.stub().resolves({
        config: {
          foo: 'bar'
        }
      });
      pkg.updateDbConfiguration = sinon.stub().resolves({_source: 'ok'});

      return pkg.unsetConfigurationProperty('foo')
        .then(() => {
          should(pkg.updateDbConfiguration)
            .be.calledOnce();
          should(pkg.updateDbConfiguration.firstCall.args[0])
            .not.have.property('foo');
        });
    });

    it('should reject the promise if the given key does not exist', () => {
      pkg.dbConfiguration = sinon.stub().resolves({
        config: {}
      });
      return should(pkg.unsetConfigurationProperty('foo'))
        .be.rejectedWith(BadRequestError, {message: 'Property foo not found in plugin configuration'});
    });

    it('should do nothing if the plugin package is marked for deletion', () => {
      pkg.dbConfiguration = sinon.stub().resolves({deleted: true});
      pkg.updateDbConfiguration = sinon.spy();

      return pkg.unsetConfigurationProperty('koo')
        .then(response => {
          should(response).match({deleted: true});
          should(pkg.updateDbConfiguration)
            .have.callCount(0);
        });

    });
  });

  describe('#importConfigurationFromFile', () => {
    it('should reject the promise if the file does not exist', () => {
      var error = new Error('test');

      return PluginPackage.__with__({
        fs: {
          readFileSync: sinon.stub().throws(error)
        }
      })(() => {
        return should(pkg.importConfigurationFromFile('path'))
          .be.rejectedWith(BadRequestError, {message: 'Error opening file path: test'});
      });
    });

    it('should reject the promise if the file does not contain some valid JSON', () => {
      return PluginPackage.__with__({
        fs: {
          readFileSync: sinon.stub().returns('{ invalid json }')
        }
      })(() => {
        return (should(pkg.importConfigurationFromFile('path')))
          .be.rejectedWith(BadRequestError, {message: 'Unable to parse path: SyntaxError: Unexpected token  '});
      });
    });

    it('should update the db configuration using the file content', () => {
      pkg.updateDbConfiguration = sinon.stub().resolves({_source: 'ok'});

      return PluginPackage.__with__({
        fs: {
          readFileSync: sinon.stub().returns('{"foo":"bar"}')
        }
      })(() => {
        return pkg.importConfigurationFromFile('path')
          .then(result => {
            should(result).be.exactly('ok');

            should(pkg.updateDbConfiguration)
              .be.calledOnce()
              .be.calledWithMatch({
                foo: 'bar'
              });
          });
      });
    });
  });


});
