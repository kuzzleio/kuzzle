"use strict";

const sinon = require("sinon");
const { Elasticsearch } = require("../../lib/service/storage/Elasticsearch");

class ElasticsearchMock extends Elasticsearch {
  constructor(config, scope) {
    super(config, scope);

    sinon.stub(this, "init").resolves();
    sinon.stub(this.client, "info").resolves();
    sinon.stub(this.client, "stats").resolves();
    sinon.stub(this.client, "scroll").resolves();
    sinon.stub(this.client, "search").resolves();
    sinon.stub(this.client, "get").resolves();
    sinon.stub(this.client, "mGet").resolves();
    sinon.stub(this.client, "count").resolves();
    sinon.stub(this.client, "create").resolves();
    sinon.stub(this.client, "createOrReplace").resolves();
    sinon.stub(this.client, "update").resolves();
    sinon.stub(this.client, "replace").resolves();
    sinon.stub(this.client, "delete").resolves();
    sinon.stub(this.client, "deleteByQuery").resolves();
    sinon.stub(this.client, "deleteFields").resolves();
    sinon.stub(this.client, "updateByQuery").resolves();
    sinon.stub(this.client, "bulkUpdateByQuery").resolves();
    sinon.stub(this.client, "createIndex").resolves();
    sinon.stub(this.client, "createCollection").resolves();
    sinon.stub(this.client, "getMapping").resolves();
    sinon.stub(this.client, "truncateCollection").resolves();
    sinon.stub(this.client, "import").resolves();
    sinon.stub(this.client, "getSchema").resolves({});
    sinon.stub(this.client, "listCollections").resolves([]);
    sinon.stub(this.client, "listIndexes").resolves([]);
    sinon.stub(this.client, "listAliases").resolves([]);
    sinon.stub(this.client, "deleteIndexes").resolves();
    sinon.stub(this.client, "deleteIndex").resolves();
    sinon.stub(this.client, "refreshCollection").resolves();
    sinon.stub(this.client, "exists").resolves();
    sinon.stub(this.client, "hasIndex").resolves();
    sinon.stub(this.client, "hasCollection").resolves();
    sinon.stub(this.client, "mCreate").resolves();
    sinon.stub(this.client, "mCreateOrReplace").resolves();
    sinon.stub(this.client, "mUpdate").resolves();
    sinon.stub(this.client, "mUpsert").resolves();
    sinon.stub(this.client, "mReplace").resolves();
    sinon.stub(this.client, "mDelete").resolves();
    sinon.stub(this.client, "deleteCollection").resolves();
    sinon.stub(this.client, "clearScroll").resolves();
    sinon.stub(this.client, "updateCollection").resolves();
    sinon.stub(this.client, "updateMapping").resolves();
    sinon.stub(this.client, "mExecute").resolves();
    sinon.stub(this.client, "upsert").resolves();
  }
}

module.exports = { Elasticsearch: ElasticsearchMock };
