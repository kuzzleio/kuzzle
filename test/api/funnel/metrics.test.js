'use strict';

const should = require('should');
const Funnel = require('../../../lib/api/funnel');
const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('funnel.metrics', () => {
  it('should returns funnel metrics Object', async () => {
    const kuzzle = new KuzzleMock();
    kuzzle.ask.withArgs('core:security:user:anonymous:get').resolves({_id: '-1'});

    const funnel = new Funnel();
    should(funnel.metrics()).match({
      concurrentRequests: 0,
      pendingRequests: 0,
    });
  });
});
