var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  mock = require('mock-require'),
  managePlugins = rewire('../../../../lib/api/controllers/remoteActions/managePlugins'),
  InternalEngine = require('../../../../lib/services/internalEngine'),
  lockFile = require('proper-lockfile'),
  path = require('path'),
  clcOk = managePlugins.__get__('clcOk'),
  clcNotice = managePlugins.__get__('clcNotice'),
  sandbox;

describe('Test: managePlugins remote action caller', () => {
  var
    internalEngineStub;

  beforeEach(() => {
    internalEngineStub = sandbox.stub(new InternalEngine({config:{}}));

    internalEngineStub.createInternalIndex.resolves();
    internalEngineStub.createOrReplace.resolves();
    internalEngineStub.get.resolves({_source: {config: {test: true}}});
    internalEngineStub.update.resolves();
    internalEngineStub.delete.resolves();

    sandbox.stub(lockFile, 'lock').yields(undefined, () => {});
    managePlugins.__set__({
      DatabaseService: function () {
        return internalEngineStub;
      },
      console: {
        log: sinon.spy(),
        error: sinon.spy(),
        dir: sinon.spy()
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('importConfig tests', () => {

    it('should raise an error if configuration file does not exist', () => {
      var options = {
        importConfig: 'config.json'
      };

      managePlugins.__set__({
        'fs': {
          readFileSync: () => {
            throw new Error();
          }
        }
      });
      return should(managePlugins('test', options)).be.rejected();
    });

    it('should raise an error if the plugin is not registered in Kuzzle', () => {
      var options = {
        importConfig: 'config.json'
      };

      internalEngineStub.get.rejects();
      managePlugins.__set__({
        'fs': {
          readFileSync: () => {
            return '{"test": true}';
          }
        }
      });
      return should(managePlugins('test', options)).be.rejected();
    });

    it('should raise an error if the file is not a json file', () => {
      var options = {
        importConfig: 'config.json'
      };

      internalEngineStub.get.rejects();
      managePlugins.__set__({
        'fs': {
          readFileSync: () => {
            return 'not a json';
          }
        }
      });
      return should(managePlugins('test', options)).be.rejected();
    });

    it('should import the configuration file for a given plugin properly', () => {
      var
        options = {
          importConfig: 'config.json'
        };

      internalEngineStub.get.resolves({_source: {}});
      managePlugins.__set__({
        'fs': {
          readFileSync: () => {
            return '{"test": true}';
          }
        }
      });
      return should(managePlugins('test', options)).be.fulfilled();
    });
  });

  describe('install tests', () => {
    it('should reinstall all plugins which exists in the database with a configuration', () => {
      var
        options = {
          install: '--path'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {path: 'fake'}}]});
      mock('fake/package.json',{pluginInfo: {defaultConfig: {}}});
      return should(managePlugins(undefined, options)).be.fulfilled();
    });

    it('should reinstall all plugins which exists in the database without a configuration', () => {
      var
        options = {
          install: true,
          path: 'fake'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {path: 'fake'}}]});
      mock('fake/package.json',{});
      return should(managePlugins(undefined, options)).be.fulfilled();
    });

    it('should install a new plugin from a path', () => {
      var
        options = {
          install: true,
          path: 'fake'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {path: 'fake'}}]});
      mock('fake/package.json', {});
      managePlugins.__set__({
        'fs': {
          existsSync: () => {
            return true;
          },
          readFileSync: () => {
            return '{}';
          }
        }
      });
      mock(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'fake', 'package.json'), {_from: '42'});
      return should(managePlugins('fake', options)).be.fulfilled();
    });

    it('should install a new plugin from a git url', () => {
      var
        options = {
          install: true,
          gitUrl: 'fakeUrl'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {gitUrl: 'fakeUrl'}}]});
      mock('fake/package.json', {});
      managePlugins.__set__({
        'fs': {
          existsSync: () => {
            return true;
          },
          readFileSync: () => {
            return '{}';
          },
          statSync: () => {
            return {
              mtime: new Date() - 3600001
            };
          },
          unlinkSync: () => {},
          closeSync: () => {},
          openSync: () => {}
        },
        'childProcess': {
          exec: (name, cb) => {
            cb(undefined);
          }
        }
      });
      return should(managePlugins('fake', options)).be.fulfilled();
    });

    it('should exit because there are no means of installation', done => {
      var
        options = {
          install: true
        },
        process = {
          exit: (status)=>{
            should(status).be.equal(1);
            done();
          }
        };

      managePlugins.__set__({
        'process': process
      });

      managePlugins('fake', options);
    });

    it('should reject a promise if the npm package cannot be downloaded', () => {
      var
        options = {
          install: true,
          gitUrl: 'fakeUrl'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {gitUrl: 'fakeUrl'}}]});
      mock('fake/package.json', {});
      managePlugins.__set__({
        'fs': {
          existsSync: () => {
            return true;
          },
          readFileSync: () => {
            return '{}';
          },
          statSync: () => {
            return {
              mtime: new Date() - 3600001
            };
          },
          unlinkSync: () => {},
          closeSync: () => {},
          openSync: () => {}
        },
        'childProcess': {
          exec: (name, cb) => {
            cb({});
          }
        }
      });
      return should(managePlugins('fake', options)).be.rejected();
    });

    it('should not install a plugin from a git url because it is less than one hour old', () => {
      var
        options = {
          install: true,
          gitUrl: 'fakeUrl'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {gitUrl: 'fakeUrl'}}]});
      mock('fake/package.json', {});
      managePlugins.__set__({
        'fs': {
          existsSync: () => {
            return true;
          },
          readFileSync: () => {
            return '{}';
          },
          statSync: () => {
            return {
              mtime: new Date()
            };
          }
        },
        'childProcess': {
          exec: (name, cb) => {
            cb(undefined);
          }
        }
      });
      return should(managePlugins('fake', options)).be.fulfilled();
    });

    it('should install a new plugin from a npm version', () => {
      var
        options = {
          install: true,
          npmVersion: '42'
        };

      internalEngineStub.search.resolves({hits: [{_id: 'foo', _source: {npmVersion: '42'}}]});
      mock('fake/package.json', {});
      managePlugins.__set__({
        'fs': {
          existsSync: () => {
            return true;
          },
          readFileSync: () => {
            return '{}';
          },
          statSync: () => {
            return {
              mtime: new Date() - 3600001
            };
          },
          unlinkSync: () => {},
          closeSync: () => {},
          openSync: () => {}
        },
        'childProcess': {
          exec: (name, cb) => {
            cb(undefined);
          }
        }
      });
      return should(managePlugins('fake', options)).be.fulfilled();
    });

  });

  describe('get tests', () => {
    it('should get configuraton properly', () => {
      var
        options = {
          get: true
        };

      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('set tests', () => {
    it('should reject because configuration is not JSON format', () => {
      var
        options = {
          set: 'not json'
        };

      return should(managePlugins('fake', options)).be.rejected();
    });

    it('should set configuration properly', () => {
      var
        options = {
          set: '{"test": true}'
        };

      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('unset tests', () => {
    it('should reject because property does not exit', () => {
      var
        options = {
          unset: 'fake'
        };

      return should(managePlugins('fake', options)).be.rejected();
    });

    it('should unset configuration properly', () => {
      var
        options = {
          unset: 'test'
        };

      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('replace tests', () => {
    it('should reject because content is not JSON format', () => {
      var
        options = {
          replace: 'not json'
        };

      return should(managePlugins('fake', options)).be.rejected();
    });

    it('should replace configuration properly', () => {
      var
        options = {
          replace: '{"test": true}'
        };

      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('remove tests', () => {
    it('should reject because the plugin does not exist', () => {
      var
        options = {
          remove: 'bad-plugin'
        };

      internalEngineStub.get.rejects({});
      return should(managePlugins('fake', options)).be.rejected();
    });

    it('should reject because an error occured during deletion', () => {
      var
        options = {
          remove: 'fake-plugin'
        },
        rimraf = sandbox.stub().throws('Error');

      managePlugins.__set__({
        'rimraf': rimraf
      });
      internalEngineStub.get.resolves({_source: {npmVersion: 42}});
      return should(managePlugins('fake', options)).be.rejected();
    });

    it('should properly delete a plugin', () => {
      var
        options = {
          remove: 'fake-plugin'
        };

      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('list tests', () => {
    it('should return the default plugins list', () => {
      var
        options = {
          list: true
        },
        fakeConfiguration = {
          'defaultConfig': {
            pluginsManager: {
              dataCollection: 'collection',
              defaultPlugins: {
                'kuzzle-fake-plugin': {
                  npmVersion: 42,
                  activated: true
                },
                'kuzzle-other-fake-plugin': {
                  path: 'fake-path',
                  activated: false
                }
              }
            },
            'jsonWebToken': {
              'algorithm': 'HS256',
              'secret': 'Kuzzle Rocks',
              'expiresIn': '1h'
            }
          }
        };

      internalEngineStub.get.resolves({_source: {}});
      internalEngineStub.search.resolves({total: 0});
      managePlugins.__set__(fakeConfiguration);
      return should(managePlugins('fake', options)).be.fulfilledWith([clcOk('kuzzle-fake-plugin (activated)'), clcNotice('kuzzle-other-fake-plugin (disabled)')]);
    });

    it('should return the plugins list from database', () => {
      var
        options = {
          list: true
        };

      mock(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'fake', 'package.json'), {_from: '42'});
      internalEngineStub.get.resolves({_source: {}});
      internalEngineStub.search.resolves({total: 1, hits: [{_id: 'fake', _source: {}}]});

      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('deactivate tests', () => {
    it('should deactivate a plugin', () => {
      var
        options = {
          deactivate: 'fake-plugin'
        };

      internalEngineStub.update.resolves({});
      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });

  describe('list tests', () => {
    it('should activate a plugin', () => {
      var
        options = {
          activate: 'fake-plugin'
        };

      internalEngineStub.update.resolves({});
      return should(managePlugins('fake', options)).be.fulfilled();
    });
  });


});
