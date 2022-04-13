'use strict';

const should = require('should');
const dumpCollection = require('../../lib/util/dump-collection');

describe('dump-collection', () => {
  let mapping;

  beforeEach(() => {
    mapping = {
      properties: {
        foo: {
          type: 'keyword'
        },
        bar: {
          type: 'integer'
        },
        baz: {
          properties: {
            qwerv: {
              type: 'date'
            },
            delta: {
              type: "constant_keyword",
              value: "debug"
            }
          }
        }
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