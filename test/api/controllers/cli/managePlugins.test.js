var
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  PluginPackageMock = require('../../../mocks/plugins/pluginPackage.mock'),
  Request = require('kuzzle-common-objects').Request,
  ManagePlugins = rewire('../../../../lib/api/controllers/cli/managePlugins');

describe('Test: managePlugins cli actions', () => {
  var
    managePlugins,
    pkg,
    release,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    pkg = new PluginPackageMock();
    kuzzle.pluginsManager.packages.getPackage.returns(Promise.resolve(pkg));
    release = sinon.spy();

    ManagePlugins.__set__({
      lockfile: {
        lock: sinon.stub().yields(undefined, release)
      }
    });

    managePlugins = ManagePlugins(kuzzle);
  });

  it('should lock', () => {
    return managePlugins(new Request({body: {}}))
      .then(() => {
        var lock = ManagePlugins.__get__('lockfile').lock;

        try {
          should(lock)
            .be.calledOnce();

          should(release)
            .be.calledOnce();

          sinon.assert.callOrder(
            lock,
            release
          );

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      });
  });

  describe('--list', () => {
    it('should return plugin packages definitions', () => {
      return managePlugins(new Request({list: true}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.packages.definitions).be.calledOnce();

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('--install', () => {
    it('should install a single plugin package if a plugin name is provided', () => {

      pkg.install.returns(Promise.resolve({success: true, name: 'banana', version: '42'}));

      return managePlugins(new Request({_id: 'plugin', install: true, foo: 'bar'}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.trigger.getCall(0))
              .be.calledWithExactly('log:info', '███ kuzzle-plugins: Installing plugin plugin...');

            should(kuzzle.pluginsManager.trigger.getCall(1))
              .be.calledWithExactly('log:info', '███ kuzzle-plugins: Plugin banana@42 installed successfully. Restart kuzzle to enable it');

            should(pkg.setDefinition)
              .be.calledOnce()
              .be.calledWith({install: true, foo: 'bar'});

            should(pkg.install).be.calledOnce();

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('--get', () => {
    it('should return the definition of the plugin', () => {
      kuzzle.pluginsManager.packages.definitions.returns(Promise.resolve({foo: 'bar'}));

      return managePlugins(new Request({_id: 'foo', get: true}))
        .then(response => {
          try {
            should(response).be.exactly('bar');

            should(kuzzle.pluginsManager.packages.definitions)
              .be.calledOnce();

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('--set', () => {
    it('should set the plugin config', () => {
      return managePlugins(new Request({_id: 'plugin', set: '{"foo":"bar"}'}))
        .then(() => {
          try {
            should(pkg.setConfigurationProperty)
              .be.calledOnce()
              .be.calledWith({
                foo: 'bar'
              });

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if an invalid JSON configuration is given', () => {
      return should(managePlugins(new Request({_id: 'plugin', set: '{ invalid json }'}))).be.rejectedWith(SyntaxError);
    });
  });

  describe('--importConfig', () => {
    it('should call the package native method', () => {
      return managePlugins(new Request({_id: 'foo', importConfig: 'file'}))
      .then(() => {
        try {
          should(kuzzle.pluginsManager.packages.getPackage)
            .be.calledOnce()
            .be.calledWithExactly('foo');

          should(pkg.importConfigurationFromFile)
            .be.calledOnce()
            .be.calledWithExactly('file');

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      });
    });
  });

  describe('--unset', () => {
    it('should call the package delete method', () => {
      return managePlugins(new Request({_id: 'foo', unset: 'bar'}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.packages.getPackage)
              .be.calledOnce()
              .be.calledWithExactly('foo');

            should(pkg.unsetConfigurationProperty)
              .be.calledOnce()
              .be.calledWithExactly('bar');

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('--replace', () => {
    it('should call the package replace method', () => {
      return managePlugins(new Request({_id: 'foo', replace: '{"foo":"bar"}'}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.packages.getPackage)
              .be.calledOnce()
              .be.calledWithExactly('foo');

            should(pkg.updateDbConfiguration)
              .be.calledOnce()
              .be.calledWith({foo: 'bar'});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if an invalid JSON is given', () => {
      return should(managePlugins(new Request({_id: 'foo', replace: '{ invalid json }'}))).be.rejectedWith(SyntaxError);
    });
  });

  describe('--remove', () => {
    it('should call the package delete method', () => {
      return managePlugins(new Request({_id: 'foo', remove: true}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.packages.getPackage)
              .be.calledOnce()
              .be.calledWithExactly('foo');

            should(pkg.delete)
              .be.calledOnce();

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('--activate && --deactivate', () => {
    it('activate', () => {
      return managePlugins(new Request({_id: 'foo', activate: true}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.packages.getPackage)
              .be.calledOnce()
              .be.calledWithExactly('foo');

            should(pkg.setActivate)
              .be.calledOnce()
              .be.calledWithExactly(true);

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('deactivate', () => {
      return managePlugins(new Request({_id: 'foo', deactivate: true}))
        .then(() => {
          try {
            should(kuzzle.pluginsManager.packages.getPackage)
              .be.calledOnce()
              .be.calledWithExactly('foo');

            should(pkg.setActivate)
              .be.calledOnce()
              .be.calledWithExactly(false);

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });
});
