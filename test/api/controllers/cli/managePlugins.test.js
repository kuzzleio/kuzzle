var
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  PluginPackageMock = require('../../../mocks/plugins/pluginPackage.mock'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
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
    kuzzle.pluginsManager.packages.getPackage.resolves(pkg);
    release = sinon.spy();

    ManagePlugins.__set__({
      lockfile: {
        lock: sinon.stub().yields(undefined, release)
      }
    });

    managePlugins = ManagePlugins(kuzzle);
  });

  describe('--list', () => {
    it('should return plugin packages definitions', () => {
      return managePlugins(new RequestObject({
        body: {
          list: true
        }
      }))
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

      pkg.install.resolves({
        success: true,
        name: 'banana',
        version: '42'
      });

      return managePlugins(new RequestObject({
        _id: 'plugin',
        body: { install: true, foo: 'bar' }
      }))
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
      kuzzle.pluginsManager.packages.definitions.resolves({foo: 'bar'});

      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            get: true
          }
        }
      })
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
      return managePlugins({
        data: {
          _id: 'plugin',
          body: {
            set: '{"foo":"bar"}'
          }
        }
      })
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
      return should(managePlugins({
        data: {
          _id: 'plugin',
          body: {
            set: '{ invalid json }'
          }
        }
      }))
        .be.rejectedWith(SyntaxError);
    });
  });

  describe('--importConfig', () => {
    it('should call the package native method', () => {
      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            importConfig: 'file'
          }
        }
      })
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
      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            unset: 'bar'
          }
        }
      })
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
      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            replace: '{"foo":"bar"}'
          }
        }
      })
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
      return should(managePlugins({
        data: {
          _id: 'foo',
          body: { replace: '{ invalid json }' }
        }
      }))
        .be.rejectedWith(SyntaxError);
    });
  });

  describe('--remove', () => {
    it('should call the package delete method', () => {
      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            remove: true
          }
        }
      })
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
      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            activate: true
          }
        }
      })
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
      return managePlugins({
        data: {
          _id: 'foo',
          body: {
            deactivate: true
          }
        }
      })
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

  it('should lock', () => {
    return managePlugins({data: { body: {}}})
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


});
