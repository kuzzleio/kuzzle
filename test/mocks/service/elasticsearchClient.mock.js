"use strict";

const sinon = require("sinon");

/**
 * Mocks an elasticsearch client instance
 * @returns {ElasticsearchClientMock}
 * @constructor
 */
class ElasticsearchClientMock {
  constructor(version = "7.0.0") {
    this.bulk = sinon.stub().resolves();
    this.count = sinon.stub().resolves();
    this.create = sinon.stub().resolves();
    this.delete = sinon.stub().resolves();
    this.exists = sinon.stub().resolves();
    this.get = sinon.stub().resolves();
    this.index = sinon.stub().resolves();
    this.info = sinon.stub().resolves({
      version: {
        number: version,
      },
    });
    this.mget = sinon.stub().resolves();
    this.update = sinon.stub().resolves();
    this.search = sinon.stub().resolves();
    this.scroll = sinon.stub().resolves();
    this.deleteByQuery = sinon.stub().resolves();
    this.updateByQuery = sinon.stub().resolves();

    this.cat = {
      aliases: sinon.stub().resolves(),
      indices: sinon.stub().resolves(),
    };

    this.cluster = {
      health: sinon.stub().resolves({
        number_of_pending_tasks: 0,
      }),
      stats: sinon.stub().resolves(),
    };

    this.indices = {
      open: sinon.stub().resolves(),
      close: sinon.stub().resolves(),
      putSettings: sinon.stub().resolves(),
      getSettings: sinon.stub().resolves(),
      create: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
      exists: sinon.stub().resolves(),
      existsType: sinon.stub().resolves(),
      getMapping: sinon.stub().resolves(),
      putMapping: sinon.stub().resolves(),
      refresh: sinon.stub().resolves(),
      stats: sinon.stub().resolves(),
      get: sinon.stub().resolves(),
      getAlias: sinon.stub().resolves(),
      updateAliases: sinon.stub().resolves(),
    };

    this.mcreate = sinon.stub().resolves();
    this.mupdate = sinon.stub().resolves();
    this.mreplace = sinon.stub().resolves();
    this.mcreateOrReplace = sinon.stub().resolves();
    this.mdelete = sinon.stub().resolves();
    this.clearScroll = sinon.stub().resolves();
    this._getRandomNumber = sinon.stub().returns(10000);
  }
}

/**
 * @type {ElasticsearchClientMock}
 */
module.exports = ElasticsearchClientMock;
