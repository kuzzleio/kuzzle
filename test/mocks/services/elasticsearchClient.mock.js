const
  sinon = require('sinon'),
  Promise = require('bluebird');

/**
 * Mocks an elasticsearch client instance
 * @returns {ElasticsearchClientMock}
 * @constructor
 */
function ElasticsearchClientMock () {
  this.bulk = sinon.stub().returns(Promise.resolve());
  this.count = sinon.stub().returns(Promise.resolve());
  this.create = sinon.stub().returns(Promise.resolve());
  this.delete = sinon.stub().returns(Promise.resolve());
  this.exists = sinon.stub().returns(Promise.resolve());
  this.get = sinon.stub().returns(Promise.resolve());
  this.index = sinon.stub().returns(Promise.resolve());
  this.info = sinon.stub().returns(Promise.resolve({
    version: {
      number: '5.4.0'
    }
  }));
  this.mget = sinon.stub().returns(Promise.resolve());
  this.update = sinon.stub().returns(Promise.resolve());
  this.search = sinon.stub().returns(Promise.resolve());
  this.scroll = sinon.stub().returns(Promise.resolve());

  this.cat = {
    indices: sinon.stub().returns(Promise.resolve())
  };

  this.cluster = {
    health: sinon.stub().returns(Promise.resolve()),
    stats: sinon.stub().returns(Promise.resolve())
  };

  this.indices = {
    create: sinon.stub().returns(Promise.resolve()),
    delete: sinon.stub().returns(Promise.resolve()),
    exists: sinon.stub().returns(Promise.resolve()),
    existsType: sinon.stub().returns(Promise.resolve()),
    getMapping: sinon.stub().returns(Promise.resolve()),
    putMapping: sinon.stub().returns(Promise.resolve()),
    refresh: sinon.stub().returns(Promise.resolve())
  };

  return this;
}

/**
 * @type {ElasticsearchClientMock}
 */
module.exports = ElasticsearchClientMock;
