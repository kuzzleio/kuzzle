var
  sinon = require('sinon');

function PluginPackageMock () {
  this.dbConfiguration = sinon.stub().returns(Promise.resolve());
  this.delete = sinon.stub().returns(Promise.resolve());
  this.importConfigurationFromFile = sinon.stub().returns(Promise.resolve());
  this.install = sinon.stub().returns(Promise.resolve());
  this.isInstalled = sinon.spy();
  this.localConfiguration = sinon.spy();
  this.localVersion = sinon.spy();
  this.needsInstall = sinon.stub().returns(Promise.resolve());
  this.needsToBeDeleted = sinon.stub().returns(Promise.resolve());
  this.setActivate = sinon.stub().returns(Promise.resolve());
  this.setConfigurationProperty = sinon.stub().returns(Promise.resolve());
  this.setDefinition = sinon.stub().returns(this);
  this.unsetConfigurationProperty = sinon.stub().returns(Promise.resolve());
  this.updateDbConfiguration = sinon.stub().returns(Promise.resolve());
}

module.exports = PluginPackageMock;
