'use strict';

const
  sinon = require('sinon'),
  ClientAdapter = require('../../lib/core/storage/clientAdapter');

class ClientAdapterMock extends ClientAdapter {
  constructor (kuzzle, scope) {
    super(kuzzle, scope);

    sinon.stub(this, 'init').callsFake(() => {
      this.registerCollectionEvents();
      this.registerIndexEvents();
      this.registerDocumentEvents();
      this.registerMappingEvents();
      this.registerCacheEvents();

      this.kuzzle.onAsk(
        `core:store:${this.scope}:info:get`,
        sinon.stub().resolves());
    });

    sinon.stub(this, 'createIndex').resolves();
    sinon.stub(this, 'createCollection').resolves();
    sinon.stub(this, 'deleteIndex').resolves();
    sinon.stub(this, 'deleteIndexes').resolves();
    sinon.stub(this, 'deleteCollection').resolves();
    sinon.stub(this, 'hasIndex').resolves();
    sinon.stub(this, 'hasCollection').resolves();
    sinon.stub(this, 'listIndexes').resolves([]);
    sinon.stub(this, 'listCollections').resolves([]);
    sinon.stub(this, 'refreshCollection').resolves();
    sinon.stub(this, 'populateCache').resolves();
    sinon.stub(this, 'loadMappings').resolves();
    sinon.stub(this, 'loadFixtures').resolves();

    sinon.stub(this.client, 'isIndexNameValid').resolves(true);
    sinon.stub(this.client, 'isCollectionNameValid').resolves(true);
  }
}

module.exports = ClientAdapterMock;
