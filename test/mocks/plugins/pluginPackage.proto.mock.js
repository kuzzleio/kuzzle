const sinon = require('sinon');

function PluginPackageMock () {}

PluginPackageMock.prototype.dbConfiguration = sinon.stub().resolves();
PluginPackageMock.prototype.delete = sinon.stub().resolves();
PluginPackageMock.prototype.importConfigurationFromFile = sinon.stub().resolves();
PluginPackageMock.prototype.install = sinon.stub().resolves();
PluginPackageMock.prototype.isInstalled = sinon.stub();
PluginPackageMock.prototype.localConfiguration = sinon.stub();
PluginPackageMock.prototype.localVersion = sinon.stub();
PluginPackageMock.prototype.needsInstall = sinon.stub().resolves();
PluginPackageMock.prototype.needsToBeDeleted = sinon.stub().resolves();
PluginPackageMock.prototype.setActivate = sinon.stub().resolves();
PluginPackageMock.prototype.setConfigurationProperty = sinon.stub().resolves();
PluginPackageMock.prototype.setDefinition = sinon.stub().returns(this);
PluginPackageMock.prototype.unsetConfigurationProperty = sinon.stub().resolves();
PluginPackageMock.prototype.updateDbConfiguration = sinon.stub().resolves();
PluginPackageMock.prototype.restore = sinon.restore;

module.exports = PluginPackageMock;
