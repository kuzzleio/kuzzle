'use strict';

const should = require('should');

const { PartialError } = require('../../../lib/kerror/errors');

describe('#PartialError', () => {
  it('should create a well-formed object with no body provided', () => {
    let err = new PartialError('foobar');

    should(err.message).be.eql('foobar');
    should(err.status).be.eql(206);
    should(err.name).be.eql('PartialError');
    should(err.errors).be.an.Array().and.be.empty();
    should(err.count).be.eql(0);
  });

  it('should create a well-formed object with a body provided', () => {
    let err = new PartialError('foobar', ['foo', 'bar']);

    should(err.message).be.eql('foobar');
    should(err.status).be.eql(206);
    should(err.name).be.eql('PartialError');
    should(err.errors).be.eql(['foo', 'bar']);
    should(err.count).be.eql(2);
  });

  it('should serialize correctly', () => {
    let err = JSON.parse(JSON.stringify(new PartialError('foobar', ['foo', 'bar'])));

    should(err.message).be.eql('foobar');
    should(err.status).be.eql(206);
    should(err.errors).be.eql(['foo', 'bar']);
    should(err.count).be.eql(2);
  });
});
