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
  this.count = sinon.stub();
  this.create = sinon.stub();
  this.delete = sinon.stub();
  this.exists = sinon.stub();
  this.get = sinon.stub();
  this.index = sinon.stub();
  this.info = sinon.stub().returns(Promise.resolve({
    version: {
      number: '5.4.0'
    }
  }));
  this.mget = sinon.stub();
  this.update = sinon.stub();
  this.search = sinon.stub();
  this.scroll = sinon.stub();

  this.cat = {
    indices: sinon.stub()
  };

  this.cluster = {
    health: sinon.stub(),
    stats: sinon.stub()
  };

  this.indices = {
    create: sinon.stub(),
    delete: sinon.stub(),
    exists: sinon.stub(),
    existsType: sinon.stub(),
    getMapping: sinon.stub(),
    putMapping: sinon.stub(),
    refresh: sinon.stub()
  };

  return this;
}

/**
 * @type {ElasticsearchClientMock}
 */
module.exports = ElasticsearchClientMock;
