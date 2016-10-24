var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  PluginPackagesManager = rewire('../../../../../lib/api/core/plugins/packages/index'),
  PluginPackageMock = require('../../../../mocks/plugins/pluginPackage.proto.mock');

describe('plugins/packages/index.js', () => {
  var
    kuzzle,
    Package,
    packages;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    Package = sinon.spy(PluginPackageMock);

    PluginPackagesManager.__set__({
      console: {
        log: sinon.spy(),
        error: sinon.spy()
      },
      PluginPackage: Package
    });


    packages = new PluginPackagesManager(kuzzle);
  });

  describe('#definitions', () => {
    it('should merge the definitions from config and db', () => {
      kuzzle.config.plugins = {
        common: {foo: 'bar'},
        plugin1: { prop: 'blah' },
        plugin2: { prop: 42 },
        plugin4: { prop: 'test' }
      };

      kuzzle.internalEngine.search.resolves({
        hits: [
          {
            _id: 'plugin2',
            _source: {
              prop: 666
            }
          },
          {
            _id: 'plugin3',
            _source: {
              prop: true
            }
          },
          {
            _id: 'plugin4',
            _source: {
              deleted: true
            }
          }
        ]
      });

      Package.prototype.localConfiguration.onSecondCall().returns({config: {foo: 'bar'}});

      return packages.definitions()
        .then(result => {
          should(result).match({
            plugin1: { prop: 'blah', config: {} },
            plugin2: { prop: 666 },
            plugin3: { prop: true }
          });

          should(Package)
            .be.calledThrice()
            .be.calledWith(kuzzle, 'plugin1')
            .be.calledWith(kuzzle, 'plugin2')
            .be.calledWith(kuzzle, 'plugin4');

          should(PluginPackageMock.prototype.localConfiguration)
            .be.calledThrice();

          should(kuzzle.internalEngine.search)
            .be.calledOnce()
            .be.calledWith('plugins');
        });
    });
  });

  describe('#bootstrap', () => {
    it('should check installation status for all packages', () => {
      sinon.stub(packages, 'definitions').resolves({
        plugin1: {},
        plugin2: {},
        plugin3: {},
        plugin4: {}
      });

      PluginPackageMock.prototype.needsToBeDeleted.resolves(false);
      PluginPackageMock.prototype.needsToBeDeleted.onFirstCall().resolves(true);

      PluginPackageMock.prototype.needsInstall.resolves(false);
      PluginPackageMock.prototype.needsInstall.onSecondCall().resolves(true);

      return packages.bootstrap()
        .then(() => {
          should(packages.definitions)
            .be.calledOnce();

          should(Package)
            .have.callCount(4);

          should(PluginPackageMock.prototype.needsToBeDeleted)
            .have.callCount(4);

          should(PluginPackageMock.prototype.delete)
            .be.calledOnce();

          should(PluginPackageMock.prototype.install)
            .be.calledOnce();
        });
    });

    it('should output the error to the console in case something goes wrong', done => {
      var
        error = new Error('error message');

      sinon.stub(packages, 'definitions').rejects(error);

      packages.bootstrap()
        .catch(e => {
          should(PluginPackagesManager.__get__('console.error'))
            .be.calledOnce()
            .be.calledWith(error, error.stack);

          should(e).be.exactly(error);

          done();
        });
    });
  });

  describe('#getPackage', () => {
    it('should extends the given definition with the one in db and return a new valid package object', () => {
      sinon.stub(packages, 'definitions').resolves({
        plugin: {
          foo: 'bar'
        }
      });

      return packages.getPackage('plugin', { prop: 42 })
        .then(result => {
          should(result).be.an.instanceOf(PluginPackageMock);

          should(Package)
            .be.calledOnce()
            .be.calledWithMatch(kuzzle, 'plugin', {
              foo: 'bar',
              prop: 42
            });
        });
    });
  });

});
