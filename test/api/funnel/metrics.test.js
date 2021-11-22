'use strict';

const should = require('should');
const Funnel = require('../../../lib/api/funnel');
const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('funnel.metrics', () => {
  it('should returns funnel metrics Object', async () => {
    const kuzzle = new KuzzleMock();
    kuzzle.ask.withArgs('core:security:user:anonymous:get').resolves({_id: '-1'});

    const funnel = new Funnel();
    const metrics = funnel.metrics();

    should(metrics).be.an.Object();
    should(metrics.concurrentRequests).be.a.Number();
    should(metrics.concurrentRequests).be.equal(0);
    should(metrics.pendingRequests).be.a.Number();
    should(metrics.pendingRequests).be.equal(0);
  });
});
