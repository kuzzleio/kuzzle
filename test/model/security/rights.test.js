'use strict';

const should = require('should');
const Rights = require('../../../lib/model/security/rights');

describe('Test: model/security/rights', () => {
  it('should correclty merge Rights', () => {
    let result;

    result = Rights.merge(undefined, { value: 'allowed' });
    should(result.value).be.equal('allowed');
    result = Rights.merge(undefined, { value: true });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'allowed' }, { value: 'allowed' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'allowed' }, { value: true });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: true }, { value: 'allowed' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: true }, { value: true });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: { foo: 'bar' } }, { value: 'allowed' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: { foo: 'bar' } }, { value: true });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'denied' }, { value: 'allowed' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'denied' }, { value: true });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'foobar' }, { value: 'allowed' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'foobar' }, { value: true });
    should(result.value).be.equal('allowed');

    result = Rights.merge({ value: 'allowed' }, { value: 'denied' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: true }, { value: 'denied' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'denied' }, { value: 'denied' });
    should(result.value).be.equal('denied');
    result = Rights.merge({ value: 'foobar' }, { value: 'denied' });
    should(result.value).be.equal('denied');

    result = Rights.merge({ value: 'allowed' }, { value: 'foobar' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: true }, { value: 'foobar' });
    should(result.value).be.equal('allowed');
    result = Rights.merge({ value: 'denied' }, { value: 'foobar' });
    should(result.value).be.equal('denied');
    result = Rights.merge({ value: 'foobar' }, { value: 'foobar' });
    should(result.value).be.equal('denied');
  });
});
