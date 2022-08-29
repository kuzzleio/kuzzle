"use strict";

const sinon = require("sinon");
const { Elasticsearch } = require("../../lib/service/storage/elasticsearch");

class ElasticsearchMock extends Elasticsearch {
  constructor(kuzzle, config, scope) {
    super(kuzzle, config, scope);

    sinon.stub(this, "init").resolves();
    sinon.stub(this, "info").resolves();
    sinon.stub(this, "stats").resolves();
    sinon.stub(this, "scroll").resolves();
    sinon.stub(this, "search").resolves();
    sinon.stub(this, "get").resolves();
    sinon.stub(this, "mGet").resolves();
    sinon.stub(this, "count").resolves();
    sinon.stub(this, "create").resolves();
    sinon.stub(this, "createOrReplace").resolves();
    sinon.stub(this, "update").resolves();
    sinon.stub(this, "replace").resolves();
    sinon.stub(this, "delete").resolves();
    sinon.stub(this, "deleteByQuery").resolves();
    sinon.stub(this, "deleteFields").resolves();
    sinon.stub(this, "updateByQuery").resolves();
    sinon.stub(this, "bulkUpdateByQuery").resolves();
    sinon.stub(this, "createIndex").resolves();
    sinon.stub(this, "createCollection").resolves();
    sinon.stub(this, "getMapping").resolves();
    sinon.stub(this, "truncateCollection").resolves();
    sinon.stub(this, "import").resolves();
    sinon.stub(this, "getSchema").resolves({});
    sinon.stub(this, "listCollections").resolves([]);
    sinon.stub(this, "listIndexes").resolves([]);
    sinon.stub(this, "listAliases").resolves([]);
    sinon.stub(this, "deleteIndexes").resolves();
    sinon.stub(this, "deleteIndex").resolves();
    sinon.stub(this, "refreshCollection").resolves();
    sinon.stub(this, "exists").resolves();
    sinon.stub(this, "hasIndex").resolves();
    sinon.stub(this, "hasCollection").resolves();
    sinon.stub(this, "mCreate").resolves();
    sinon.stub(this, "mCreateOrReplace").resolves();
    sinon.stub(this, "mUpdate").resolves();
    sinon.stub(this, "mUpsert").resolves();
    sinon.stub(this, "mReplace").resolves();
    sinon.stub(this, "mDelete").resolves();
    sinon.stub(this, "deleteCollection").resolves();
    sinon.stub(this, "clearScroll").resolves();
    sinon.stub(this, "updateCollection").resolves();
    sinon.stub(this, "updateMapping").resolves();
    sinon.stub(this, "mExecute").resolves();
    sinon.stub(this, "upsert").resolves();
  }
}

module.exports = ElasticsearchMock;
