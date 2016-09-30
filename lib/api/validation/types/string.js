var BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function StringType () {
  this.typeName = 'string';
}

StringType.prototype = new BaseConstructor();

/**
 * @param {string} fieldName
 * @param {CollectionSpecification} collectionSpecification
 * @param {*} document
 */
StringType.prototype.validate = function (fieldName, collectionSpecification, document) {
  // TODO
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
StringType.prototype.validateFieldSpecification = function (fieldSpecification) {
  return true;
};

module.exports = StringType;