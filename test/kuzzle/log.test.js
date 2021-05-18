'use strict';

const should = require('should');

const Logger = require('../../lib/kuzzle/log');
const KuzzleMock = require('../mocks/kuzzle.mock');

describe('/lib/kuzzle/log', () => {
  let logger;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.asyncStore.exists.returns(false);
    kuzzle.asyncStore.has.returns(true);
    kuzzle.asyncStore.get.returns({ id: 'request-unique-id' });

    logger = new Logger();
    logger._useLogger();
  });

  it('should add the node id in log', () => {
    logger.info('Kiev');

    should(kuzzle.emit).be.calledWith('log:info', '[knode-nasty-author-4242] Kiev');
  });

  it('should add the requestId in log', () => {
    kuzzle.asyncStore.exists.returns(true);

    logger.info('Kiev');

    should(kuzzle.emit).be.calledWith('log:info', '[knode-nasty-author-4242] [request-unique-id] Kiev');
  });
});
