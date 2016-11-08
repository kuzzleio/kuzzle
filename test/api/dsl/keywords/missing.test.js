'use strict';

var
  should = require('should'),
  sinon = require('sinon'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.missing', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#standardization', () => {
    it('should return a "not exists" condition', () => {
      let spy = sinon.spy(dsl.transformer.standardizer.dsl, 'exists');

      return dsl.transformer.standardizer.standardize({missing: {field: 'foo'}})
        .then(result => {
          should(spy.called).be.true();
          should(result).match({
            not: {
              exists: {
                field: 'foo'
              }
            }
          });
        });
    });
  });
});
