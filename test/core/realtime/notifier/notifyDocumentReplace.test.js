'use strict';

const should = require('should');
const sinon = require('sinon');

const { Request } = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentReplace', () => {
  let kuzzle;
  let request;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier();

    sinon.stub(notifier, 'notifyDocument').resolves();

    request = new Request({
      index: 'index',
      collection: 'collection',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: {
        foo: 'bar',
        _kuzzle_info: {
          'can I has': 'cheezburgers?'
        }
      }
    });

    return notifier.init();
  });

  it('should notify subscribers when a replaced document entered their scope', async () => {
    const _id = request.input.args._id;

    kuzzle.koncorde.test.returns(['foo']);

    const result = await notifier.notifyDocumentReplace(
      request,
      {
        _id,
        _source: request.input.body,
      },
      JSON.stringify(['foo', 'bar']));

    should(notifier.notifyDocument.callCount).be.eql(2);

    should(notifier.notifyDocument.getCall(0))
      .calledWith(['foo'], request, 'in', 'replace', {
        _id,
        _source: request.input.body,
      });

    should(notifier.notifyDocument.getCall(1))
      .calledWith(['bar'], request, 'out', 'replace', { _id, _source: request.input.body });

    should(result).match(['foo']);
  });

  it('should return an empty array if no room matches the replaced document', async () => {
    kuzzle.koncorde.test.returns([]);

    const rooms = await notifier.notifyDocumentReplace(
      request,
      {
        _id: request.input.args._id,
        _source: request.input.body,
      },
      JSON.stringify(['foo', 'bar']));

    should(rooms).be.an.Array().and.be.empty();
  });
});
