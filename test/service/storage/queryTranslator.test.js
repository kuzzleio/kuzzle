'use strict';

const should = require('should');

const QueryTranslator = require('../../../lib/service/storage/queryTranslator');

describe('QueryTranslator', () => {
  const translator = new QueryTranslator();

  describe('_translateClause', () => {
    it('can translate the clause "equals"', () => {
      const clause = {
        equals: { city: 'Istanbul' }
      };

      const esClause = translator._translateClause(...Object.entries(clause)[0]);

      should(esClause).be.eql({
        term: { city: 'Istanbul' }
      });
    });

    it('can translate the clause "exists"', () => {
      const clause = {
        exists: 'city'
      };

      const esClause = translator._translateClause(...Object.entries(clause)[0]);

      should(esClause).be.eql({
        exists: { field: 'city' }
      });
    });

    it('can translate the clause "ids"', () => {
      const clause = {
        ids: {
          values: ['aschen', 'melis']
        }
      };

      const esClause = translator._translateClause(...Object.entries(clause)[0]);

      should(esClause).be.eql({
        ids: {
          values: ['aschen', 'melis']
        }
      });
    });

    it('can translate the clause "missing"', () => {
      const clause = {
        missing: 'city'
      };

      const esClause = translator._translateClause(...Object.entries(clause)[0]);

      should(esClause).be.eql({
        bool: {
          must_not: [
            { exists: { field: 'city' } }
          ]
        }
      });
    });

    it('can translate the clause "range"', () => {
      const clause = {
        range: {
          age: { gt: 25, gte: 25, lt: 27, lte: 27 }
        }
      };

      const esClause = translator._translateClause(...Object.entries(clause)[0]);

      should(esClause).be.eql({
        range: {
          age: { gt: 25, gte: 25, lt: 27, lte: 27 }
        }
      });
    });
  });

  describe('_translateOperator', () => {
    it('can translate operator "and"', () => {
      const operator = {
        and: []
      };

      const esOperator = translator._translateOperator(...Object.entries(operator)[0]);

      should(esOperator).be.eql({
        bool: {
          filter: []
        }
      });
    });

    it('can translate operators "or"', () => {
      const operator = {
        or: []
      };

      const esOperator = translator._translateOperator(...Object.entries(operator)[0]);

      should(esOperator).be.eql({
        bool: {
          should: []
        }
      });
    });

    it('can translate operator "not"', () => {
      const operator = {
        not: { exists: 'city' }
      };

      const esOperator = translator._translateOperator(...Object.entries(operator)[0]);

      should(esOperator).be.eql({
        bool: {
          must_not: [
            { exists: { field: 'city' } }
          ]
        }
      });
    });
  });

  describe('translate', () => {
    it('can translate complexe filters', () => {
      const filters = {
        and: [
          { equals: { city: 'Antalya' } },
          {
            not: {
              exists: 'age'
            }
          }
        ]
      };

      const esQuery = translator.translate(filters);

      should(esQuery).be.eql({
        bool: {
          filter: [
            { term: { city: 'Antalya' } },
            {
              bool: {
                must_not: [
                  { exists: { field: 'age' } }
                ]
              }
            }
          ]
        }
      });
    });

    it('can translate simple filters', () => {
      const filters = {
        equals: { city: 'Istanbul' }
      };

      const esQuery = translator.translate(filters);

      should(esQuery).be.eql({
        term: {
          city: 'Istanbul'
        }
      });
    });
  });
});
