'use strict';

const sinon = require('sinon');

/**
 * Mocks an elasticsearch client instance
 * @returns {ElasticsearchClientMock}
 * @constructor
 */
class ElasticsearchClientMock {
  constructor() {
    this.bulk = sinon.stub().resolves();
    this.count = sinon.stub().resolves();
    this.create = sinon.stub().resolves();
    this.delete = sinon.stub().resolves();
    this.exists = sinon.stub().resolves();
    this.get = sinon.stub().resolves();
    this.index = sinon.stub().resolves();
    this.info = sinon.stub().resolves({
      body: {
        version: {
          number: '7.0.0'
        }
      }
    });
    this.mget = sinon.stub().resolves();
    this.update = sinon.stub().resolves();
    this.search = sinon.stub().resolves();
    this.scroll = sinon.stub().resolves();
    this.deleteByQuery = sinon.stub().resolves();
    this.updateByQuery = sinon.stub().resolves();

    this.cat = {
      aliases: sinon.stub().resolves(),
      indices: sinon.stub().resolves()
    };

    this.cluster = {
      health: sinon.stub().resolves(),
      stats: sinon.stub().resolves()
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
      refresh: sinon.stub().resolves()
    };

    this.mcreate = sinon.stub().resolves();
    this.mupdate = sinon.stub().resolves();
    this.mreplace = sinon.stub().resolves();
    this.mcreateOrReplace = sinon.stub().resolves();
    this.mdelete = sinon.stub().resolves();
  }
}

/**
 * @type {ElasticsearchClientMock}
 */
module.exports = ElasticsearchClientMock;
