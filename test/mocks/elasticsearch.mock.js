'use strict';

const sinon = require('sinon');
const Elasticsearch = require('../../lib/service/storage/elasticsearch');

class ElasticsearchMock extends Elasticsearch {
  constructor (kuzzle, config, scope) {
    super(kuzzle, config, scope);

    this.init = sinon.stub().resolves();
    this.info = sinon.stub().resolves();
    this.scroll = sinon.stub().resolves();
    this.search = sinon.stub().resolves();
    this.get = sinon.stub().resolves();
    this.mGet = sinon.stub().resolves();
    this.count = sinon.stub().resolves();
    this.create = sinon.stub().resolves();
    this.createOrReplace = sinon.stub().resolves();
    this.update = sinon.stub().resolves();
    this.replace = sinon.stub().resolves();
    this.delete = sinon.stub().resolves();
    this.deleteByQuery = sinon.stub().resolves();
    this.updateByQuery = sinon.stub().resolves();
    this.createIndex = sinon.stub().resolves();
    this.createCollection = sinon.stub().resolves();
    this.getMapping = sinon.stub().resolves();
    this.truncateCollection = sinon.stub().resolves();
    this.import = sinon.stub().resolves();
    this.listCollections = sinon.stub().resolves([]);
    this.listIndexes = sinon.stub().resolves([]);
    this.listAliases = sinon.stub().resolves([]);
    this.deleteIndexes = sinon.stub().resolves();
    this.deleteIndex = sinon.stub().resolves();
    this.refreshCollection = sinon.stub().resolves();
    this.exists = sinon.stub().resolves();
    this.indexExists = sinon.stub().resolves();
    this.collectionExists = sinon.stub().resolves();
    this.mCreate = sinon.stub().resolves();
    this.mCreateOrReplace = sinon.stub().resolves();
    this.mUpdate = sinon.stub().resolves();
    this.mReplace = sinon.stub().resolves();
    this.mDelete = sinon.stub().resolves();
    this.deleteCollection = sinon.stub().resolves();
    this.clearScroll = sinon.stub().resolves();
  }
}

module.exports = ElasticsearchMock;
