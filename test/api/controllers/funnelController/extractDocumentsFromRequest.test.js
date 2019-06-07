'use strict';

const
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.extractDocumentFromRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
  });

  it('extract document with create action', () => {
    const req = new Request({
      action: 'create',
      body: {
        foo: 'bar',
      }
    });

    const documents = funnel.extractDocumentsFromRequest(req);
    should(documents.length).equal(1);
    should(documents[0].source.foo).equal('bar');
  });

  it('extract document with mCreate action', () => {
    const req = new Request({
      action: 'mCreate',
      body: {
        documents: [
          {
            _id: 'abc',
            body: {
              foo: 'bar',
            }
          },
          {
            _id: 'def',
            body: {
              baz: 'qux',
            }
          }
        ]
      }
    });

    const documents = funnel.extractDocumentsFromRequest(req);
    should(documents.length).equal(2);
    should(documents[0]._id).equal('abc');
    should(documents[0].source.foo).equal('bar');
    should(documents[1]._id).equal('def');
    should(documents[1].source.baz).equal('qux');
  });

  it('extract document with delete action', () => {
    const req = new Request({
      action: 'delete',
      _id: 'foobar',
    });

    const documents = funnel.extractDocumentsFromRequest(req);
    should(documents.length).equal(1);
    should(documents[0]._id).equal('foobar');
  });

  it('extract document with mDelete action', () => {
    const req = new Request({
      action: 'mDelete',
      body: {
        ids: ['foobar', 'bazqux']
      }
    });

    const documents = funnel.extractDocumentsFromRequest(req);
    should(documents.length).equal(2);
    should(documents[0]._id).equal('foobar');
    should(documents[1]._id).equal('bazqux');
  });
});