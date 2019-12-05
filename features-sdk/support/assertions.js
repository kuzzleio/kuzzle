const
  _ = require('lodash'),
  should = require('should');

should.Assertion.add(
  'matchObject',
  function (expected) {
    this.params = { operator: 'match object' };

    for (const [keyPath, expectedValue] of Object.entries(expected)) {
      const objectValue = _.get(this.obj, keyPath);

      if (expectedValue === '_ANY_') {
        should(objectValue).not.be.undefined();
      }
      else if (expectedValue === '_STRING_') {
        should(objectValue).be.String();
      }
      else if (expectedValue === '_NUMBER_') {
        should(objectValue).be.Number();
      }
      else {
        should(objectValue)
          .match(expectedValue, `${keyPath} does not match. Expected ${JSON.stringify(expectedValue)} have ${objectValue}`);
      }
    }
  },
  false
);
