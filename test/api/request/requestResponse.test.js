'use strict';

const should = require('should');

const { BadRequestError } = require('../../../lib/kerror/errors');
const { Request } = require('../../../lib/api/request');
const { RequestResponse } = require('../../../lib/api/request');
const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('#RequestResponse', () => {
  let req;
  let kuzzle;

  beforeEach(() => {
    // eslint-disable-next-line no-unused-vars
    kuzzle = new KuzzleMock();

    req = new Request({
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    });
  });

  describe('#constructor', () => {
    it('should populate a valid response object', () => {
      let response = new RequestResponse(req);

      should(response.status).be.exactly(req.status);
      should(response.error).be.exactly(req.error);
      should(response.requestId).be.exactly(req.id);
      should(response.controller).be.exactly(req.input.controller);
      should(response.action).be.exactly(req.input.action);
      should(response.collection).be.exactly(req.input.args.collection);
      should(response.index).be.exactly(req.input.args.index);
      should(response.volatile).be.exactly(req.input.volatile);
      should(response.headers).match({
        'X-Kuzzle-Node': 'knode-nasty-author-4242'
      });
      should(response.result).be.exactly(req.result);
      should(response.node).be.eql(kuzzle.id);
      should(response.deprecations).be.undefined();
    });

    it('should throw if we try to extend the response', () => {
      let response = new RequestResponse(req);

      should(() => {
        response.foo = 'bar'; 
      }).throw(TypeError);
    });
  });

  describe('#properties', () => {
    it('should set the request status', () => {
      const response = new RequestResponse(req);

      response.status = 666;
      should(req.status).be.exactly(666);
    });

    it('should set the request error', () => {
      const
        error = new BadRequestError('test'),
        response = new RequestResponse(req);

      response.error = error;
      should(req.error).be.exactly(error);
      should(req.status).be.exactly(error.status);
    });

    it('should set the request result', () => {
      const
        result = {foo: 'bar'},
        response = new RequestResponse(req);

      response.result = result;
      should(req.result).be.exactly(result);
    });
  });

  describe('headers', () => {
    let response;

    beforeEach(() => {
      response = new RequestResponse(req);
    });

    it('should set headers without changing their names', () => {
      response.setHeader('X-Foo', 'Bar');
      response.setHeader('X-Bar', 'Baz');

      should(response.headers).match({
        'X-Foo': 'Bar',
        'X-Bar': 'Baz'
      });
    });

    it('should store cookies in an array', () => {
      response.setHeader('Set-Cookie', 'test');
      should(response.headers['Set-Cookie'])
        .be.an.Array()
        .have.length(1);
      should(response.headers['Set-Cookie'][0]).be.exactly('test');

      response.setHeader('Set-Cookie', 'test2');
      should(response.headers['Set-Cookie'][1]).be.exactly('test2');
    });

    it('should overwrite common HTTP headers when submitting new values', () => {
      [
        'age',
        'authorization',
        'content-length',
        'content-type',
        'etag',
        'expires',
        'from',
        'host',
        'if-modified-since',
        'if-unmodified-since',
        'last-modified, location',
        'max-forwards',
        'proxy-authorization',
        'referer',
        'retry-after',
        'user-agent'
      ].forEach(name => {
        for (let i = 0; i < 10; i++) {
          response.setHeader(name, `foobar${i}`);
        }

        should(response.headers[name]).be.exactly(
          'foobar9',
          `Header tested: ${name}`);
      });
    });

    it('should not duplicate header keys', () => {
      [ 'Content-Length', 'X-Foo', 'Set-Cookie' ].forEach(name => {
        response.setHeader(name, 'foo');
        response.setHeader(name.toLowerCase(), 'bar');
        response.setHeader(name.toUpperCase(), 'baz');

        should(response.headers)
          .have.property(name)
          .and.not.have.property(name.toLowerCase())
          .and.not.have.property(name.toUpperCase());
      });
    });

    it('should add values to existing regular headers', () => {
      response.setHeader('X-Baz', 'Foo');
      response.setHeader('X-Baz', 'Bar');

      should(response.headers['X-Baz']).be.exactly('Foo, Bar');
    });

    it('should set multiple headers to the existing headers', () => {
      response.setHeader('X-Foo', 'foo');
      response.setHeader('test', 'test');

      response.setHeaders({ test: 'test', banana: '42' });

      should(response.headers).have.property('X-Foo');
      should(response.headers).have.property('test', 'test, test');
      should(response.headers).have.property('banana', '42');
    });

    it('should not set headers if already existing', () => {
      response.setHeader('X-Foo', 'foo');
      response.setHeader('test', 'test');

      response.setHeaders({ test: 'foobar', banana: '42' }, true);

      should(response.headers).have.property('X-Foo');
      should(response.headers).have.property('test', 'test');
      should(response.headers).have.property('banana', '42');
    });

    it('should do nothing if a null header is provided', () => {
      response.setHeaders(null);

      should(response.headers).match({
        'X-Kuzzle-Node': 'knode-nasty-author-4242'
      });
    });

    it('should merge duplicates when injecting properties directly into the object', () => {
      response.headers.oh = 'noes11!1';
      response.headers.OH = 'NOES!!1!';

      should(response.headers.oh).eql('noes11!1, NOES!!1!');
      should(response.headers.OH).eql('noes11!1, NOES!!1!');

      const headersPOJO = JSON.parse(JSON.stringify(response.headers));

      should(headersPOJO.oh).eql('noes11!1, NOES!!1!');
      should(headersPOJO.OH).be.undefined();
    });

    it('should throw if setHeader is called with non-string names', () => {
      [ {}, 1.42, true, [] ].forEach(name => {
        should(() => response.setHeader(name, 'test')).throw(BadRequestError);
      });
    });

    it('should do nothing if a null or undefined header name is provided', () => {
      [ null, undefined ].forEach(name => {
        should(() => response.setHeader(name, 'foo')).not.throw();

        should(response.headers).match({
          'X-Kuzzle-Node': 'knode-nasty-author-4242'
        });
      });
    });

    it('should stringify values passed to setHeader', () => {
      [
        {foo: 'bar'},
        1.42,
        true,
        ['baz', true, null],
        null,
        undefined
      ].forEach(value => {
        response.setHeader('test', value);

        should(response.headers.test).eql(String(value));

        response.removeHeader('test');
      });
    });
  });

  describe('removeHeader', () => {
    let response;

    beforeEach(() => {
      response = new RequestResponse(req);
    });

    it('should remove the asked header', () => {
      response.setHeader('X-Foo', 'foo');
      response.setHeader('X-Bar', 'bar');

      response.removeHeader('X-Foo');

      should(response.headers).not.have.property('X-Foo');
      should(response.headers).have.property('X-Bar', 'bar');
    });

    it('should remove the asked header (case insensitive)', () => {
      response.setHeader('X-Foo', 'foo');
      response.setHeader('X-Bar', 'bar');

      response.removeHeader('x-fOO');

      should(response.headers).not.have.property('X-Foo');
      should(response.headers).have.property('X-Bar', 'bar');
    });
  });

  describe('getHeader', () => {
    let response;

    beforeEach(() => {
      response = new RequestResponse(req);
    });

    it('should fetch the asked header', () => {
      response.setHeader('X-Foo', 'foo');
      response.setHeader('X-Bar', 'bar');

      should(response.getHeader('X-Foo')).eql('foo');
    });

    it('should fetch the asked header (case insensitive)', () => {
      response.setHeader('X-Foo', 'foo');
      response.setHeader('X-Bar', 'bar');

      should(response.getHeader('x-fOO')).eql('foo');
    });
  });

  describe('configure', () => {
    let response;

    beforeEach(() => {
      response = new RequestResponse(req);
    });

    it('should allow the user to configure the headers of the response', () => {
      const testHeader = { 'X-Foo': 'foo' };

      response.configure({ headers: testHeader });
      should(response.getHeader('X-Foo')).eql('foo');
    });

    it('should allow the user to configure the status of the response', () => {
      response.configure({ status: 402 });
      should(response.status).eql(402);
    });

    it('should allow the user to configure the format of the response', () => {
      response.configure({ format: 'raw' });
      should(response.raw).be.true();
      response.configure({ format: 'standard' });
      should(response.raw).be.false();
    });
  });

  describe('toJSON', () => {
    it('should return a valid JSON object in Kuzzle format', () => {
      let response = new RequestResponse(req);

      response.setHeader('x-foo', 'bar');

      should(response.toJSON()).have.properties(['raw', 'status', 'requestId', 'content', 'headers']);
      should(response.toJSON().content).have.properties([
        'error',
        'requestId',
        'controller',
        'action',
        'collection',
        'index',
        'volatile',
        'result',
        'deprecations'
      ]);
      should(response.toJSON().raw).be.false();
      should(response.toJSON().headers).match({'x-foo': 'bar'});
    });

    it('should return a valid JSON object in raw format', () => {
      let response = new RequestResponse(req);

      response.raw = true;
      response.setHeader('x-foo', 'bar');
      response.result = 'foobar';
      response.status = 666;

      should(response.toJSON()).have.properties(['raw', 'content', 'headers']);
      should(response.toJSON().status).be.eql(666);
      should(response.toJSON().content).be.eql('foobar');
      should(response.toJSON().raw).be.true();
      should(response.toJSON().headers).match({'x-foo': 'bar'});
    });
  });

});
