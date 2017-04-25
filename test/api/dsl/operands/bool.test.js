'use strict';

const
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  DSL = require('../../../../lib/api/dsl');

describe('DSL.operands.bool', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({bool: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with unrecognized bool attributes', () => {
      return should(dsl.validate({bool: {must: [{exists: {foo: 'bar'}}], foo: 'bar'}})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#standardization', () => {
    it('should standardize bool attributes with AND/OR/NOT operands', () => {
      let bool = {
        bool: {
          must : [
            {
              in : {
                firstName : ['Grace', 'Ada']
              }
            },
            {
              range: {
                age: {
                  gte: 36,
                  lt: 85
                }
              }
            }
          ],
          'must_not' : [
            {
              equals: {
                city: 'NYC'
              }
            }
          ],
          should : [
            {
              equals : {
                hobby : 'computer'
              }
            },
            {
              exists : {
                field : 'lastName'
              }
            }
          ],
          should_not: [
            {
              regexp: {
                hobby: {
                  value: '^.*ball',
                  flags: 'i'
                }
              }
            }
          ]
        }
      };

      return dsl.transformer.standardizer.standardize(bool)
        .then(result => {
          should(result).match({
            and: [
              {or: [
                {equals: {firstName: 'Grace'}},
                {equals: {firstName: 'Ada'}}
              ]},
              {or: [
                {equals: {hobby: 'computer'}},
                {exists: {field: 'lastName'}}
              ]},
              {and: [
                {range: {age: {gte: 36, lt: 85}}},
                {not: {equals: {city: 'NYC'}}},
                {not: {regexp: {hobby: {value: '^.*ball', flags: 'i'}}}}
              ]}
            ]
          });
        });
    });
  });
});
