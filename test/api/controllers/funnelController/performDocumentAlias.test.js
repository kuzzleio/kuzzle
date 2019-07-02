'use strict';

const
  should = require('should'),
  { Request } = require('kuzzle-common-objects'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
  });

  it('should trigger document before alias pipe', () => {
    const request = new Request({
      controller: 'document',
      action: 'create'
    });

    funnel.performDocumentAlias(request, 'before');
    const args = kuzzle.pipe.getCall(0).args;

    should(args[0]).equal('generic:document:beforeWrite');
    should(args[1]).be.type('object');
    should(args[2]).be.type('object');
  });

  it('should trigger document after alias pipe', () => {
    const request = new Request({
      controller: 'document',
      action: 'create'
    });

    funnel.performDocumentAlias(request, 'after');
    const args = kuzzle.pipe.getCall(0).args;
    should(args[0]).equal('generic:document:afterWrite');
    should(args[1]).be.type('object');
    should(args[2]).be.type('object');
  });

  it('should not trigger document before alias pipe', () => {
    const request = new Request({
      controller: 'document',
      action: 'search'
    });

    funnel.performDocumentAlias(request, 'before');
    should(kuzzle.pipe).have.callCount(0);
  });

});
