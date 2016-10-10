var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Validation = rewire('../../../../lib/api/core/validation'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: validation utilities', () => {
  var
    sandbox = sinon.sandbox.create(),
    genericMock = {
      foo: 'bar'
    };

  beforeEach(() => {
    sandbox.restore();
  });

  describe('#checkAllowedProperties', () => {
    var checkAllowedProperties = Validation.__get__('checkAllowedProperties');

    it('should be true with proper arguments', () => {
      should(checkAllowedProperties(genericMock, ['foo', 'mod'])).be.true();
    });

    it('should be false if the first argument is not an object', () => {
      should(checkAllowedProperties('notAnObject', ['foo'])).be.false();
    });

    it('should be false if one of the property is not allowed', () => {
      should(checkAllowedProperties({foo:'bar', baz: 'bar'}, ['foo'])).be.false();
    });
  });

  describe('#curateStructuredFields', () => {
    /**
     * TODO
     */
  });

  describe('#getParent', () => {
    var getParent = Validation.__get__('getParent');

    it('should return the root if the field has one part', () => {
      var
        structuredField = {
          children: {
            foo: 'bar'
          }
        },
        fieldPath = ['foo'];

      should(getParent(structuredField, fieldPath)).be.deepEqual(structuredField);
    });

    it('should return the good parent that corresponds to the parent\'s field path', () => {
      var
        structuredField = {
          children: {
            foo: {
              children: {
                bar: {
                  children: {
                    baz: 'mod'
                  }
                }
              }
            }
          }
        },
        fieldPath = ['foo', 'bar', 'baz'];

      should(getParent(structuredField, fieldPath)).be.deepEqual(structuredField.children.foo.children.bar);
    });

    it('should throw an error if the fieldPath does not fit the structure', () => {
      var
        structuredField = {
          children: {
            foo: {
              children: {
                notBar: {
                  children: {
                    baz: 'mod'
                  }
                }
              }
            }
          }
        },
        fieldPath = ['foo', 'bar', 'baz'];

      (() => {
        getParent(structuredField, fieldPath);
      }).should.throw();
    });
  });

  describe('#addErrorMessage', () => {
    /**
     * TODO
     */
  });

  describe('#getValidationConfiguration', () => {
    var
      kuzzle,
      getValidationConfiguration = Validation.__get__('getValidationConfiguration');

    beforeEach(() => {
      kuzzle = new KuzzleMock();
    });

    it('should return the default configuration if nothing is returned from internal engine', () => {
      kuzzle.config.validation = genericMock;
      kuzzle.internalEngine.search = sandbox.stub().resolves({hits: []});

      return getValidationConfiguration(kuzzle)
        .then(result => {
          should(result).be.deepEqual(kuzzle.config.validation);
        });
    });

    it('should return an empty object if nothing is returned from internal engine and there is no configuration', () => {
      delete kuzzle.config.validation;
      kuzzle.internalEngine.search = sandbox.stub().resolves({hits: []});

      return getValidationConfiguration(kuzzle)
        .then(result => {
          should(result).be.deepEqual({});
        });
    });

    it('should return a well formed configuration when getting results from internal engine', () => {
      var internalEngineResponse = {
        hits: [
          {
            _source: {
              index: 'anIndex',
              collection: 'aCollection',
              validation: 'validation1'
            }
          },
          {
            _source: {
              index: 'anIndex',
              collection: 'anotherCollection',
              validation: 'validation2'
            }
          },
          {
            _source: {
              index: 'anotherIndex',
              collection: 'aCollection',
              validation: 'validation3'
            }
          },
          {
            _source: {
              index: 'anotherIndex',
              collection: 'anotherCollection',
              validation: 'validation4'
            }
          }
        ]
      };
      var expectedConfiguration = {
        anIndex: {
          aCollection: 'validation1',
          anotherCollection: 'validation2'
        },
        anotherIndex: {
          aCollection: 'validation3',
          anotherCollection: 'validation4'
        }
      };

      kuzzle.internalEngine.search = sandbox.stub().resolves(internalEngineResponse);

      return getValidationConfiguration(kuzzle)
        .then(result => {
          should(result).be.deepEqual(expectedConfiguration);
        });
    });
  });
});
