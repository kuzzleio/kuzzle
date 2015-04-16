var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods');

module.exports = function Dsl (kuzzle) {

  this.filterTransformer = function (filter) {
    return {
      'subject' : 'termSubjectKuzzle'
    };
  };

};