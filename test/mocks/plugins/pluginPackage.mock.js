var
  sinon = require('sinon');

function PluginPackageMock () {
  this.dbConfiguration = sinon.stub().resolves();
  this.delete = sinon.stub().resolves();
  this.importConfigurationFromFile = sinon.stub().resolves();
  this.install = sinon.stub().resolves();
  this.isInstalled = sinon.spy();
  this.localConfiguration = sinon.spy();
  this.localVersion = sinon.spy();
  this.needsInstall = sinon.stub().resolves();
  this.needsToBeDeleted = sinon.stub().resolves();
  this.setActivate = sinon.stub().resolves();
  this.setConfigurationProperty = sinon.stub().resolves();
  this.setDefinition = sinon.stub().returns(this);
  this.unsetConfigurationProperty = sinon.stub().resolves();
  this.updateDbConfiguration = sinon.stub().resolves();
}

module.exports = PluginPackageMock;
