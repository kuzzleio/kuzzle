'use strict';

const
  should = require('should'),
  { Request } = require('kuzzle-common-objects'),
  DocumentExtractor = require('../../lib/util/DocumentExtractor');

describe('DocumentExtractor', () => {

  it('extract documents from request with create action', () => {
    const req = new Request({
      action: 'create',
      _id: 'foobar',
      body: {
        foo: 'bar',
      }
    });

    const documents = new DocumentExtractor(req).extract();
    should(documents.length).equal(1);
    should(documents[0]._source.foo).equal('bar');
    should(documents[0]._id).equal('foobar');
  });

  it('extract documents from request with mCreate action', () => {
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

    const documents = new DocumentExtractor(req).extract();

    should(documents.length).equal(2);
    should(documents[0]._id).equal('abc');
    should(documents[0]._source.foo).equal('bar');
    should(documents[1]._id).equal('def');
    should(documents[1]._source.baz).equal('qux');
  });

  it('extract documents from request with delete action', () => {
    const req = new Request({
      action: 'delete',
      _id: 'foobar',
    });

    const documents = new DocumentExtractor(req).extract();
    should(documents.length).equal(1);
    should(documents[0]._id).equal('foobar');
  });

  it('extract documents from request with mDelete action', () => {
    const req = new Request({
      action: 'mDelete',
      body: {
        ids: ['foobar', 'bazqux']
      }
    });

    const documents = new DocumentExtractor(req).extract();
    should(documents.length).equal(2);
    should(documents[0]._id).equal('foobar');
    should(documents[1]._id).equal('bazqux');
  });

  it('insert documents from request with create action', () => {
    const req = new Request({
      action: 'create',
      body: {
        foo: 'bar',
      }
    });

    const documents = [{
      _id: 'foobar',
      _source: {
        foo: 'baz',
      }
    }];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.input.resource._id).equal('foobar');
    should(newReq.input.body.foo).equal('baz');
  });

  it('insert documents from request with mCreate action', () => {
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

    const documents = [
      { _id: 'foo', _source: { foo: 'qux' }},
      { _id: 'foo2', _source: { foo: 'bar' }},
      { _id: 'foo3', _source: { foo: 'baz' }},
    ];

    const newReq = new DocumentExtractor(req).insert(documents);

    should(newReq.input.body.documents[0]._id).equal('foo');
    should(newReq.input.body.documents[0].body.foo).equal('qux');
    should(newReq.input.body.documents[1]._id).equal('foo2');
    should(newReq.input.body.documents[1].body.foo).equal('bar');
    should(newReq.input.body.documents[2]._id).equal('foo3');
    should(newReq.input.body.documents[2].body.foo).equal('baz');
  });

  it('insert documents from request with delete action', () => {
    const req = new Request({
      action: 'delete',
      _id: 'foobar',
    });

    const documents = [{ _id: 'foobaz' }];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.input.resource._id).equal('foobaz');
  });

  it('insert documents from request with mDelete action', () => {
    const req = new Request({
      action: 'mDelete',
      body: {
        ids: ['foobar', 'bazqux']
      }
    });

    const documents = [
      { _id: 'foo' },
      { _id: 'bar' },
      { _id: 'baz' },
    ];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.input.body.ids.length).equal(3);
    should(newReq.input.body.ids[0]).equal('foo');
    should(newReq.input.body.ids[1]).equal('bar');
    should(newReq.input.body.ids[2]).equal('baz');
  });

  it('extract documents from result with create action', () => {
    const req = new Request({
      action: 'create',
      _id: 'foobar',
      body: {
        foo: 'bar',
      }
    });

    req.setResult({
      _id: 'foobaz',
      _source: {
        foo: 'baz'
      }
    });

    const documents = new DocumentExtractor(req).extract();
    should(documents.length).equal(1);
    should(documents[0]._source.foo).equal('baz');
    should(documents[0]._id).equal('foobaz');
  });

  it('extract documents from result with mCreate action', () => {
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

    req.setResult({
      successes: [
        {
          _id: 'fooabc',
          _source: {
            a: 'b',
          }
        },
        {
          _id: 'foodef',
          _source: {
            c: 'd'
          }
        }
      ],
      errors: []
    });

    const documents = new DocumentExtractor(req).extract();

    should(documents.length).equal(2);
    should(documents[0]._id).equal('fooabc');
    should(documents[0]._source.a).equal('b');
    should(documents[1]._id).equal('foodef');
    should(documents[1]._source.c).equal('d');
  });

  it('extract documents from result with delete action', () => {
    const req = new Request({
      action: 'delete',
      _id: 'foobar',
    });

    req.setResult({
      _id: 'foobaz'
    });

    const documents = new DocumentExtractor(req).extract();
    should(documents.length).equal(1);
    should(documents[0]._id).equal('foobaz');
  });

  it('extract documents from result with mDelete action', () => {
    const req = new Request({
      action: 'mDelete',
      body: {
        ids: ['foobar', 'bazqux']
      }
    });

    req.setResult({
      successes: ['foobar', 'foobaz'],
      errors: []
    });

    const documents = new DocumentExtractor(req).extract();

    should(documents.length).equal(2);
    should(documents[0]._id).equal('foobar');
    should(documents[1]._id).equal('foobaz');
  });

  it('insert documents from result with create action', () => {
    const req = new Request({
      action: 'create',
      body: {
        foo: 'bar',
      }
    });

    req.setResult({});

    const documents = [{
      _id: 'foobar',
      _source: {
        foo: 'baz',
      }
    }];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.result._id).equal('foobar');
    should(newReq.result._source.foo).equal('baz');
  });

  it('insert documents from result with mCreate action', () => {
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

    req.setResult({});

    const documents = [
      { _id: 'foo', _source: { foo: 'qux' }},
      { _id: 'foo2', _source: { foo: 'bar' }},
      { _id: 'foo3', _source: { foo: 'baz' }},
    ];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.result.successes[0]._id).equal('foo');
    should(newReq.result.successes[0]._source.foo).equal('qux');
    should(newReq.result.successes[1]._id).equal('foo2');
    should(newReq.result.successes[1]._source.foo).equal('bar');
    should(newReq.result.successes[2]._id).equal('foo3');
    should(newReq.result.successes[2]._source.foo).equal('baz');
  });

  it('insert documents from result with delete action', () => {
    const req = new Request({
      action: 'delete',
      _id: 'foobar',
    });

    req.setResult({});

    const documents = [{ _id: 'foobaz' }];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.result._id).equal('foobaz');
  });

  it('insert documents from result with mDelete action', () => {
    const req = new Request({
      action: 'mDelete',
      body: {
        ids: ['foobar', 'bazqux']
      }
    });

    req.setResult({});

    const documents = [
      { _id: 'foo' },
      { _id: 'bar' },
      { _id: 'baz' },
    ];

    const newReq = new DocumentExtractor(req).insert(documents);
    should(newReq.result.successes.length).equal(3);
    should(newReq.result.successes[0]).equal('foo');
    should(newReq.result.successes[1]).equal('bar');
    should(newReq.result.successes[2]).equal('baz');
  });
});