var
  sinon = require('sinon'),
  Promise = require('bluebird'),
  sandbox = sinon.sandbox.create();

function PluginPackageMock () {}

PluginPackageMock.prototype.dbConfiguration = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.delete = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.importConfigurationFromFile = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.install = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.isInstalled = sinon.stub();
PluginPackageMock.prototype.localConfiguration = sinon.stub();
PluginPackageMock.prototype.localVersion = sinon.stub();
PluginPackageMock.prototype.needsInstall = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.needsToBeDeleted = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.setActivate = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.setConfigurationProperty = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.setDefinition = sinon.stub().returns(this);
PluginPackageMock.prototype.unsetConfigurationProperty = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.updateDbConfiguration = sinon.stub().returns(Promise.resolve());
PluginPackageMock.prototype.restore = sandbox.restore;

module.exports = PluginPackageMock;
