"use strict";

const sinon = require("sinon");
const { VirtualIndex } = require("../../lib/service/storage/virtualIndex");

class VirtualIndexMock extends VirtualIndex {
  //initWithClient
  constructor() {
    super();
    sinon.stub(this, "init").resolves();
    this.editSoftTenantMap = sinon.stub();
    this.getRealIndex = function (name) {
      return name;
    };
    this.isVirtual = sinon.stub(false);
    this.getId = function (index, id) {
      return id;
    };
    this.randomString = sinon.stub();
    this.getVirtualId = function (index, id) {
      return id;
    };
    sinon.stub(this, "createVirtualIndex").resolves();
    this.removeVirtualIndex = sinon.stub();
    sinon.stub(this, "initVirtualIndexList").resolves();
    sinon.stub(this, "buildCollection").resolves();
  }
}

module.exports = VirtualIndexMock;
