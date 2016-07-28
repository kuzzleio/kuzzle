var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  mock = require('mock-require'),
  lockFile = require('proper-lockfile'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ManagePlugins = rewire('../../../../lib/api/controllers/remoteActions/managePlugins'),
  sandbox = sinon.sandbox.create();

describe('Test: managePlugins remote action caller', function () {
  var
    kuzzle;

  sandbox.stub(lockFile, 'lock').yields(undefined, () => {});
  ManagePlugins.__set__({
    lockFile
  });

  beforeEach(() => {
    kuzzle = {
      config: {
        pluginsManager: {
          dataCollection: 'collection'
        }
      },
      internalEngine: {
        createInternalIndex: sandbox.stub().resolves(),
        createOrReplace: sandbox.stub().resolves(),
        delete: sandbox.stub().resolves(),
        get: sandbox.stub().resolves({_source: {config: {test: true}}}),
        replace: sandbox.stub().resolves(),
        search: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        updateMapping: sandbox.stub().resolves()
      },
      pluginsManager: {
        trigger: sandbox.spy()
      }
    };
    ManagePlugins(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
    mock.stopAll();
  });

  describe('#pluginsManager', () => {
    var
      pluginsManager = ManagePlugins.__get__('pluginsManager'),
      reset,
      lockStub,
      releaseStub,
      getPluginsListStub,
      installPluginsStub,
      getPluginConfigurationStub,
      setPluginConfigurationStub,
      importPluginConfigurationStub,
      unsetPluginConfigurationStub,
      replacePluginConfigurationStub,
      removePluginStub;

    beforeEach(() => {
      releaseStub = sinon.stub();
      reset = ManagePlugins.__set__({
        lockfile: {
          lock: sandbox.stub().yields(undefined, releaseStub)
        },
        initializeInternalIndex: sandbox.stub().resolves(),
        getPluginsList: sandbox.spy(),
        installPlugins: sandbox.spy(),
        getPluginConfiguration: sandbox.spy(),
        setPluginConfiguration: sandbox.spy(),
        importPluginConfiguration: sandbox.spy(),
        unsetPluginConfiguration: sandbox.spy(),
        replacePluginConfiguration: sandbox.spy(),
        removePlugin: sandbox.spy()
      });

      lockStub = ManagePlugins.__get__('lockfile').lock;
      getPluginsListStub = ManagePlugins.__get__('getPluginsList');
      installPluginsStub = ManagePlugins.__get__('installPlugins');
      getPluginConfigurationStub = ManagePlugins.__get__('getPluginConfiguration');
      setPluginConfigurationStub = ManagePlugins.__get__('setPluginConfiguration');
      importPluginConfigurationStub = ManagePlugins.__get__('importPluginConfiguration');
      unsetPluginConfigurationStub = ManagePlugins.__get__('unsetPluginConfiguration');
      replacePluginConfigurationStub = ManagePlugins.__get__('replacePluginConfiguration');
      removePluginStub = ManagePlugins.__get__('removePlugin');
    });

    afterEach(() => {
      reset();
    });

    it('should call getPluginsList if --list option is given', () => {
      var request = new RequestObject({body: {list: true}});

      return pluginsManager(request)
        .then(() => {
          should(lockStub).be.calledOnce();
          should(getPluginsListStub).be.calledOnce();
          should(releaseStub).be.calledOnce();
        });
    });

    it('should call installPlugins if --install option is given', () => {
      var request = new RequestObject({_id: 'test', body: {install: true}});

      return pluginsManager(request)
        .then(() => {
          should(installPluginsStub).be.calledOnce();
          should(installPluginsStub).be.calledWith('test', {install: true});
        });

    });

    it('should call getPluginConfiguration if --get is given', () => {
      var request = new RequestObject({_id: 'test', body: {get: true}});

      return pluginsManager(request)
        .then(() => {
          should(getPluginConfigurationStub).be.calledOnce();
          should(getPluginConfigurationStub).be.calledWithExactly('test');
        });
    });

    it('should call setPluginConfiguration if --set is given', () => {
      var request = new RequestObject({_id: 'test', body: {set: true}});

      return pluginsManager(request)
        .then(() => {
          should(setPluginConfigurationStub).be.calledOnce();
          should(setPluginConfigurationStub).be.calledWith('test', true);
        });
    });

    it('should call importPluginConfiguration if --importConfig is given', () => {
      var request = new RequestObject({_id: 'test', body: {importConfig: true}});

      return pluginsManager(request)
        .then(() => {
          should(importPluginConfigurationStub).be.calledOnce();
          should(importPluginConfigurationStub).be.calledWithExactly('test', true);
        });
    });

    it('should call unsetPluginConfiguration if --unset is given', () => {
      var request = new RequestObject({_id: 'test', body: {unset: true}});

      return pluginsManager(request)
        .then(() => {
          should(unsetPluginConfigurationStub).be.calledOnce();
          should(unsetPluginConfigurationStub).be.calledWithExactly('test', true);
        });
    });

    it('should call replacePluginConfiguration if --replace is given', () => {
      var request = new RequestObject({_id: 'test', body: {replace: true}});

      return pluginsManager(request)
        .then(() => {
          should(replacePluginConfigurationStub).be.calledOnce();
          should(replacePluginConfigurationStub).be.calledWithExactly('test', true);
        });
    });

    it('should call removePlugin if --remove is given', () => {
      var request = new RequestObject({_id: 'test', body: {remove: true}});

      return pluginsManager(request)
        .then(() => {
          should(removePluginStub).be.calledOnce();
          should(removePluginStub).be.calledWithExactly('test');
        });
    });

    it('should activate the plugin if required', () => {
      var request = new RequestObject({_id: 'test', body: {activate: true}});

      return pluginsManager(request)
        .then(() => {
          should(kuzzle.internalEngine.update).be.calledOnce();
          should(kuzzle.internalEngine.update).be.calledWith('collection', 'test', {activated: true});
          should(getPluginConfigurationStub).be.calledOnce();
          sinon.assert.callOrder(kuzzle.internalEngine.update, getPluginConfigurationStub);
        });
    });

    it('should deactivate the plugin if required', () => {
      var request = new RequestObject({_id: 'test', body: {deactivate: true}});

      return pluginsManager(request)
        .then(() => {
          should(kuzzle.internalEngine.update).be.calledOnce();
          should(kuzzle.internalEngine.update).be.calledWith('collection', 'test', {activated: false});
          should(getPluginConfigurationStub).be.calledOnce();
          sinon.assert.callOrder(kuzzle.internalEngine.update, getPluginConfigurationStub);
        });
    });

    it('should release the lock in case of error', done => {
      var
        error = new Error('test'),
        request = new RequestObject({_id: 'test'});

      ManagePlugins.__with__({
        initializeInternalIndex: sinon.stub().rejects(error)
      })(() => {
        return pluginsManager(request)
          .catch(err => {
            should(err).be.eql(error);
            should(releaseStub).be.calledOnce();
            done();
          });
      });
    });

    it('should retry if a 503 error is received', () => {
      var
        error = {message: 'test', status: 503},
        request = new RequestObject({_id: 'test'}),
        setTimeoutStub = sinon.stub().yields('test'),
        indexStub = sinon.stub();

      indexStub.onFirstCall().rejects(error);
      indexStub.resolves({});

      return ManagePlugins.__with__({
        setTimeout: setTimeoutStub,
        initializeInternalIndex: indexStub
      })(() => {
        return pluginsManager(request)
          .then(() => {
            should(setTimeoutStub).be.calledOnce();
          });
      });
    });

  });

  describe('#initializeInternalIndex', () => {
    var
      initializeInternalIndex = ManagePlugins.__get__('initializeInternalIndex');

    it('should do nothing if the index already exists', () => {
      kuzzle.internalEngine.createInternalIndex.rejects({status: 400});

      return initializeInternalIndex()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).have.callCount(0);
        });
    });

    it('should reject the promise if an error occurred on es layer', () => {
      var error = new Error('test');

      kuzzle.internalEngine.createInternalIndex.rejects(error);

      return should(initializeInternalIndex()).be.rejectedWith(error);
    });

    it('should create the mapping if needed', () => {
      return initializeInternalIndex()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('collection',
            {properties: {config: {enabled: false}}}
          );
        });
    });

  });

  describe('#importPluginConfiguration', () => {
    var
      importPluginConfiguration,
      readFileSyncStub,
      reset;

    beforeEach(() => {
      reset = ManagePlugins.__set__({
        fs: {
          readFileSync: sandbox.stub().returns('{"foo": "bar"}')
        }
      });
      readFileSyncStub = ManagePlugins.__get__('fs').readFileSync;
      importPluginConfiguration = ManagePlugins.__get__('importPluginConfiguration');
    });

    afterEach(() => {
      reset();
    });

    it('should reject the promise if the file does not exist', () => {
      var error = new Error('test');

      return ManagePlugins.__with__({
        fs: {
          readFileSync: sandbox.stub().throws(error)
        }
      })(() => {
        return should(importPluginConfiguration()).be.rejectedWith('Error opening file undefined: test');
      });
    });

    it('should reject the promise if the content is not a valid JSON', () => {
      return ManagePlugins.__with__({
        fs: {
          readFileSync: sandbox.stub().returns('I am not a valid json')
        }
      })(() => {
        return should(importPluginConfiguration()).be.rejectedWith('Unable to parse undefined: SyntaxError: Unexpected token I');
      });
    });

    it('should reject the promise if the plugin configuration is not found', () => {
      var error = new Error('test');

      kuzzle.internalEngine.get.rejects(error);

      return should(importPluginConfiguration('plugin')).be.rejectedWith('Plugin plugin not found');
    });

    it('should update the plugin config', () => {
      kuzzle.internalEngine.get.resolves({_source: {}});

      return importPluginConfiguration('plugin')
        .then(() => {
          should(readFileSyncStub).be.calledOnce();
          should(kuzzle.internalEngine.createOrReplace).be.calledOnce();
          should(kuzzle.internalEngine.createOrReplace).be.calledWith('collection', 'plugin', {config: {foo: 'bar'}});
        });
    });

  });

  describe('#installPlugins', function() {
    var
      acquirePluginSpy,
      updatePluginsConfigurationSpy,
      installPlugins,
      reset;

    beforeEach(() => {
      reset = ManagePlugins.__set__({
        acquirePlugins: sandbox.stub().resolves(),
        updatePluginsConfiguration: sandbox.stub().resolves()
      });
      acquirePluginSpy = ManagePlugins.__get__('acquirePlugins');
      updatePluginsConfigurationSpy = ManagePlugins.__get__('updatePluginsConfiguration');
      installPlugins = ManagePlugins.__get__('installPlugins');
    });

    afterEach(() => {
      reset();
    });

    it('should reinstall all plugins which exist in the database with a configuration', () => {
      var
        pluginList = {
          foo: {path: 'fake'},
          bar: {path: 'fake'}
        };

      mock('fake/package.json', {pluginInfo: {defaultConfig: {}}});

      return ManagePlugins.__with__({
        getPluginsList: sandbox.stub().resolves(pluginList)
      })(() => {
        return installPlugins()
          .then(() => {
            should(acquirePluginSpy).be.calledOnce();
            should(acquirePluginSpy).be.calledWithExactly(pluginList);
            should(updatePluginsConfigurationSpy).be.calledOnce();
            should(updatePluginsConfigurationSpy).be.alwaysCalledWithExactly(pluginList);
          });
      });
    });

    it('should install a new plugin from a path', function () {
      return installPlugins('foo', {path: 'fake', activated: 'activated'})
        .then(() => {
          should(acquirePluginSpy).be.calledOnce();
          should(acquirePluginSpy).be.calledWithExactly({
            foo: {
              path: 'fake',
              activated: 'activated'
            }
          });
        });
    });

    it('should install a new plugin from a git url', function () {
      return installPlugins('foo', {gitUrl: 'fake', activated: 'activated'})
        .then(() => {
          should(acquirePluginSpy).be.calledOnce();
          should(acquirePluginSpy).be.calledWithExactly({
            foo: {
              gitUrl: 'fake',
              activated: 'activated'
            }
          });
        });
    });

    it('should install a new plugin from npm', () => {
      return installPlugins('foo', {npmVersion: 'fake', activated: 'activated'})
        .then(() => {
          should(acquirePluginSpy).be.calledOnce();
          should(acquirePluginSpy).be.calledWithExactly({
            foo: {
              npmVersion: 'fake',
              activated: 'activated'
            }
          });
        });
    });

  });

  describe('#getPluginsList', () => {
    var
      getPluginsList = ManagePlugins.__get__('getPluginsList');

    it('should get the plugins from db', () => {
      kuzzle.internalEngine.search.resolves({
        total: 2,
        hits: [
          {_id: 'foo', _source: 'fooSource'},
          {_id: 'bar', _source: 'barSource'}
        ]
      });

      return getPluginsList()
        .then(plugins => {
          should(plugins).be.eql({
            foo: 'fooSource',
            bar: 'barSource'
          });
        });
    });

    it('should return Kuzzle plugins configuration if none is set in db', () => {
      kuzzle.internalEngine.search.resolves({total: 0});

      return getPluginsList()
        .then(plugins => {
          should(plugins).be.exactly(kuzzle.config.pluginsManager.defaultPlugins);
        });
    });

  });

  describe('#acquirePlugins', () => {
    var
      acquirePlugins,
      needInstallSpy,
      npmInstallSpy,
      reset;

    beforeEach(() => {
      reset = ManagePlugins.__set__({
        needInstall: sandbox.stub().resolves(),
        npmInstall: sandbox.stub().resolves()
      });
      needInstallSpy = ManagePlugins.__get__('needInstall');
      npmInstallSpy = ManagePlugins.__get__('npmInstall');
      acquirePlugins = ManagePlugins.__get__('acquirePlugins');
    });

    afterEach(() => {
      reset();
    });

    it('should reject if no installation mean is given', () => {
      return should(() => acquirePlugins({foo: {}}))
        .throw('███ kuzzle-plugins: Plugin foo provides no means of installation. Expected: path, git URL or npm version');
    });

    it('should handle all installation methods', () => {
      return acquirePlugins({
        foo: {
          path: 'fake'
        },
        bar: {
          npmVersion: 'version'
        },
        baz: {
          gitUrl: 'gitUrl'
        }
      })
        .then(() => {
          should(needInstallSpy).be.calledThrice();
          should(needInstallSpy.firstCall).be.calledWith({path: 'fake'}, 'foo');
          should(needInstallSpy.secondCall).be.calledWith({npmVersion: 'version'}, 'bar');
          should(needInstallSpy.thirdCall).be.calledWith({gitUrl: 'gitUrl'}, 'baz');
          should(npmInstallSpy).be.calledTwice();
          should(npmInstallSpy.firstCall).be.calledWith({npmVersion: 'version'}, 'bar');
          should(npmInstallSpy.secondCall).be.calledWith({gitUrl: 'gitUrl'}, 'baz');
        });
    });

  });

  describe('#npmInstall', () => {
    var
      npmInstall,
      childProcessExecStub,
      createLockSpy,
      reset;

    beforeEach(() => {
      reset = ManagePlugins.__set__({
        childProcess: {
          exec: sandbox.stub().yields()
        },
        createLock: sandbox.spy(),
        getPluginPath: sandbox.spy()
      });

      childProcessExecStub = ManagePlugins.__get__('childProcess').exec;
      createLockSpy = ManagePlugins.__get__('createLock');

      npmInstall = ManagePlugins.__get__('npmInstall');
    });

    afterEach(() => {
      reset();
    });

    it('should reject a promise if the npm package cannot be downloaded', () => {
      var error = new Error('test');

      childProcessExecStub.yields(error);

      return ManagePlugins.__with__({
        childProcess: {
          exec: childProcessExecStub
        }
      })(() => {
        return should(npmInstall({}, 'plugin')).be.rejectedWith(error);
      });
    });

    it('should install a new plugin from a npm version', () => {
      return npmInstall({npmVersion: '42'}, 'foo')
        .then(() => {
          should(childProcessExecStub).be.calledOnce();
          should(childProcessExecStub).be.calledWith('npm install foo@42');
        });
    });

    it('should install a new plugin from github', () => {
      return npmInstall({gitUrl: 'someUrl'}, 'foo')
        .then(() => {
          should(createLockSpy).be.calledOnce();
          should(childProcessExecStub).be.calledOnce();
          should(childProcessExecStub).be.calledWith('npm install someUrl');
        });
    });

  });

  describe('#updatePluginsConfiguration', () => {
    var
      updatePluginsConfiguration = ManagePlugins.__get__('updatePluginsConfiguration'),
      reset;

    beforeEach(() => {
      reset = ManagePlugins.__set__({
        getPathPlugin: sinon.stub(),

      });
    });

    afterEach(() => {
      reset();
    });

    it('should return a rejected promise if the path plugin package.json cannot be found', () => {
      var error = new Error('error');

      return ManagePlugins.__with__({
        require: () => { throw error; }
      })(() => {
        return should(updatePluginsConfiguration({test: {path: 'fake'}}))
          .be.rejectedWith(error);
      });
    });

    it('should return a rejected promise if the npm plugin package.json cannot be found', () => {
      var error = new Error('error');

      return ManagePlugins.__with__({
        require: () => { throw error; }
      })(() => {
        return should(updatePluginsConfiguration({test: {}}))
          .be.rejectedWith(error);
      });
    });

    it('should update the plugin configuration', () => {
      return ManagePlugins.__with__({
        require: () => { return {pluginInfo: {test: true}}; }
      })(() => {
        return updatePluginsConfiguration({test: {foo: 'bar', defaultConfig: {bar: 'baz'}}})
          .then(() => {
            should(kuzzle.internalEngine.createOrReplace).be.calledOnce();
            should(kuzzle.internalEngine.createOrReplace).be.calledWith('collection', 'test', {
              activated: true,
              config: {bar: 'baz'},
              foo: 'bar',
              test: true
            });
          });
      });
    });

  });

  describe('#createLock', () => {
    var
      createLock = ManagePlugins.__get__('createLock');

    it('should do its job', () => {
      return ManagePlugins.__with__({
        fs: {
          openSync: sandbox.stub().returns('open'),
          closeSync: sandbox.spy()
        },
        path: {
          join: sandbox.stub().returns('join')
        }
      })(() => {
        var
          openSyncSpy = ManagePlugins.__get__('fs').openSync,
          closeSyncSpy = ManagePlugins.__get__('fs').closeSync,
          joinSpy = ManagePlugins.__get__('path').join;

        createLock('path');

        should(joinSpy).be.calledOnce();
        should(joinSpy).be.calledWithExactly('path', 'lock');
        should(openSyncSpy).be.calledWith();
        should(openSyncSpy).be.calledWithExactly('join', 'w');
        should(closeSyncSpy).be.calledOnce();
        should(closeSyncSpy).be.calledWithExactly('open');
      });
    });
  });

  describe('#needInstall', () => {
    var
      needInstall,
      existsSyncSpy,
      statSyncSpy,
      unlinkSyncSpy,
      reset;

    beforeEach(() => {
      reset = ManagePlugins.__set__({
        fs: {
          existsSync: sandbox.stub().returns(true),
          statSync: sandbox.stub(),
          unlinkSync: sandbox.stub()
        },
        getPluginPath: sandbox.stub().returns('testPath'),
        path: {
          join: sandbox.stub().returns('testPath')
        },
      });
      existsSyncSpy = ManagePlugins.__get__('fs').existsSync;
      statSyncSpy = ManagePlugins.__get__('fs').statSync;
      unlinkSyncSpy = ManagePlugins.__get__('fs').unlinkSync;

      needInstall = ManagePlugins.__get__('needInstall');
    });

    afterEach(() => {
      reset();
    });

    it('should return false if the plugin is a git install and was installed less than 1 hour ago', () => {
      var response;

      existsSyncSpy.returns(true);
      statSyncSpy.returns({
        mtime: new Date()
      });

      response = needInstall({gitUrl: 'gitUrl'}, 'plugin');

      should(response).be.false();
      should(unlinkSyncSpy).have.callCount(0);
    });

    it('should return false if installing a plugin from path', () => {
      var response = needInstall({path: 'path'}, 'test');

      should(response).be.false();
    });

    it('should return true if no package.json can be found', () => {
      existsSyncSpy.returns(false);

      should(needInstall({})).be.true();
    });

    it('should return false if the package.json version is the same as requested', () => {
      mock('testPath', {_from: 'test@42'});

      should(needInstall({npmVersion: '42'}, 'test')).be.false();
    });

    it('should return true if the package.json version differs from the requested one', () => {
      mock('testPath', {_from: 'test@1'});

      should(needInstall({npmVersion: '42'}, 'test')).be.true();
    });

  });

  describe('#getPluginPath', () => {
    var
      getPluginPath = ManagePlugins.__get__('getPluginPath');

    it('should return the plugin path if given a path setting', () => {
      should(getPluginPath({path: 'path'})).be.exactly('path');
    });

    it('should return the node_modules computed path', () => {
      should(getPluginPath({}, 'test')).be.exactly(require.main.filename.replace(/\/node_modules\/.*$/, '') + '/node_modules/test');
    });

  });

  describe('#getPluginConfiguration', () => {
    it('should do its job', () => {
      var data = {_source: {foo: 'bar'}};
      kuzzle.internalEngine.get.resolves(data);

      return ManagePlugins.__get__('getPluginConfiguration')('test')
        .then(response => {
          should(kuzzle.internalEngine.get).be.calledOnce();
          should(kuzzle.internalEngine.get).be.calledWithExactly('collection', 'test');
          should(response).be.exactly(data._source);
        });
    });
  });

  describe('#setPluginConfiguration', () => {
    var
      setPluginConfiguration = ManagePlugins.__get__('setPluginConfiguration');

    it('should reject the promise if an invalid json is given', () => {
      return should(setPluginConfiguration('test', 'Invalid json'))
        .be.rejectedWith('Unable to parse Invalid json. Expected: JSON Object\nSyntaxError: Unexpected token I');
    });

    it('should update the plugin configuration', () => {
      kuzzle.internalEngine.get.resolves({_source: {config: {bar: 'baz'}}});

      return ManagePlugins.__with__({
        getPluginConfiguration: sandbox.spy()
      })(() => {
        return setPluginConfiguration('test', '{"foo":"bar"}')
          .then(() => {
            should(kuzzle.internalEngine.get).be.calledOnce();
            should(kuzzle.internalEngine.get).be.calledWithExactly('collection', 'test');
            should(kuzzle.internalEngine.update).be.calledOnce();
            should(kuzzle.internalEngine.update).be.calledWithMatch('collection',
              'test',
              {
                config: {
                  bar: 'baz',
                  foo: 'bar'
                }
              }
            );
            should(ManagePlugins.__get__('getPluginConfiguration')).be.calledOnce();
            should(ManagePlugins.__get__('getPluginConfiguration')).be.calledWithExactly('test');
          });
      });
    });

  });

  describe('#unsetPluginConfiguration', () => {
    var
      unsetPluginConfiguration = ManagePlugins.__get__('unsetPluginConfiguration');

    it('should reject the promise if the property does not exist', () => {
      kuzzle.internalEngine.get.resolves({_source: { config: {}}});

      return should(unsetPluginConfiguration('test', 'property'))
        .be.rejectedWith('Property property not found in the plugin configuration');
    });

    it('should do its job', () => {
      kuzzle.internalEngine.get.resolves({_source: {config: {property: false}}});

      return ManagePlugins.__with__({
        getPluginConfiguration: sandbox.spy()
      })(() => {
        return unsetPluginConfiguration('test', 'property')
          .then(() => {
            should(kuzzle.internalEngine.get).be.calledOnce();
            should(kuzzle.internalEngine.get).be.calledWithExactly('collection', 'test');
            should(kuzzle.internalEngine.replace).be.calledOnce();
            should(kuzzle.internalEngine.replace).be.calledWithExactly('collection',
              'test',
              {config: {}}
            );
          });
      });
    });

  });

  describe('#replacePluginConfiguration', () => {
    var
      replacePluginConfiguration = ManagePlugins.__get__('replacePluginConfiguration');

    it('should reject the promise if an invalid JSON is given', () => {
      return should(replacePluginConfiguration('test', 'Invalid JSON'))
        .be.rejectedWith('Unable to parse the new plugin configuration. Expected: JSON Object\nSyntaxError: Unexpected token I');
    });

    it('should replace the plugin configuration', () => {
      kuzzle.internalEngine.get.resolves({_source: {config: {bar: 'baz'}}});

      return ManagePlugins.__with__({
        getPluginConfiguration: sandbox.spy()
      })(() => {
        return replacePluginConfiguration('test', '{"foo":"bar"}')
          .then(() => {
            should(kuzzle.internalEngine.get).be.calledOnce();
            should(kuzzle.internalEngine.get).be.calledWithExactly('collection', 'test');
            should(kuzzle.internalEngine.replace).be.calledWithExactly('collection',
              'test',
              {config: {foo: 'bar'}}
            );
          });
      });
    });

  });

  describe('#removePlugin', () => {
    var
      removePlugin = ManagePlugins.__get__('removePlugin');

    it('should reject the promise if an error occurred deleting the plugin', () => {
      var error = new Error('test');

      kuzzle.internalEngine.get.resolves({_source: {npmVersion: '42'}});

      return ManagePlugins
        .__with__('getPluginPath', sandbox.stub().throws(error))(
          () => {
            return should(removePlugin('test'))
              .be.rejectedWith('Unable to remove the plugin module: Error: test');
          }
        );
    });

    it('should not delete plugins installed with the path option', () => {
      return ManagePlugins.__with__({
        getPluginPath: sandbox.stub().returns('path'),
        rimraf: sandbox.stub().yields()
      })(() => {
        kuzzle.internalEngine.get.resolves({_source: {path: 'path'}});

        return removePlugin('test')
          .then(response => {
            should(response).be.eql({installedLocally: undefined});
            should(ManagePlugins.__get__('rimraf')).have.callCount(0);
          });
      });
    });

    it('should delete the module if installed locally', () => {
      return ManagePlugins.__with__({
        getPluginPath: sandbox.stub().returns('path'),
        rimraf: sandbox.stub().yields()
      })(() => {
        kuzzle.internalEngine.get.resolves({_source: {gitUrl: 'gitUrl'}});

        return removePlugin('test')
          .then(response => {
            should(response).be.eql({installedLocally: 'gitUrl'});
            should(kuzzle.internalEngine.delete).be.calledOnce();
            should(kuzzle.internalEngine.delete).be.calledWithExactly('collection', 'test');
            should(ManagePlugins.__get__('rimraf')).be.calledOnce();
            should(ManagePlugins.__get__('rimraf')).be.calledWith('path');
          });
      });
    });

  });

});
