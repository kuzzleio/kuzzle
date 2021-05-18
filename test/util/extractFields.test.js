'use strict';

const should = require('should');
const extractFields = require('../../lib/util/extractFields');

describe('util/extractFields', () => {
  let document;

  beforeEach(() => {
    document = {
      foo: 'valueFoo',
      bar: {
        a: 'valueBarA',
        b: 'valueBarB'
      }
    };
  });

  it('Should extract fields recursively', () => {
    const result = extractFields(document);

    should(result).match(['foo', 'bar.a', 'bar.b']);
  });

  it('Should ignore requested fields', () => {
    const result = extractFields(document, { fieldsToIgnore: ['bar'] });

    should(result).match(['foo']);
  });

  it('Should extract values when asked to', () => {
    const result = extractFields(document, { alsoExtractValues: true });

    should(result).match([
      { key: 'foo', value: 'valueFoo' },
      { key: 'bar.a', value: 'valueBarA' },
      { key: 'bar.b', value: 'valueBarB' }
    ]);
  });
});