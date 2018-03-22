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
    sandbox.resetHistory();
  });

  describe('#checkAllowedProperties', () => {
    var
      checkAllowedProperties = Validation.__get__('checkAllowedProperties');

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
    var
      curateStructuredFields = Validation.__get__('curateStructuredFields');

    it('should return a verbose representation of fields', () => {
      var
        maxDepth = 3,
        typeAllowChildren = ['object'],
        fields = {
          1: [{path: ['aField'], type: 'object'}, {path: ['anotherField'], type: 'object'}],
          2: [{path: ['aField', 'aSubField'], type: 'object'}, {path: ['aField', 'anotherSubField'], type: 'object'}],
          3: [{path: ['aField', 'aSubField', 'aSubSubField'], type: 'object'}, {path: ['aField', 'aSubField', 'anotherSubSubField'], type: 'object'}]
        },
        expectedStructuredFields = {
          root: true,
          children: {
            aField: {
              path: ['aField'],
              type: 'object',
              children: {
                aSubField: {
                  path: ['aField', 'aSubField'],
                  type: 'object',
                  children: {
                    aSubSubField: {
                      path: ['aField', 'aSubField', 'aSubSubField'],
                      type: 'object'
                    },
                    anotherSubSubField: {
                      path: ['aField', 'aSubField', 'anotherSubSubField'],
                      type: 'object'
                    }
                  }
                },
                anotherSubField: {
                  path: ['aField', 'anotherSubField'],
                  type: 'object'
                }
              }
            },
            anotherField: {
              path: ['anotherField'],
              type: 'object'
            }
          }
        };

      should(curateStructuredFields(typeAllowChildren, fields, maxDepth)).be.deepEqual(expectedStructuredFields);
    });

    it('should throw an error if a field level is missing', () => {
      var
        maxDepth = 3,
        typeAllowChildren = ['object'],
        fields = {
          1: [{path: ['aField'], type: 'object'}, {path: ['anotherField'], type: 'object'}],
          3: [{path: ['aField', 'aSubField', 'aSubSubField'], type: 'object'}, {path: ['aField', 'aSubField', 'anotherSubSubField'], type: 'object'}]
        };

      should(() => {
        curateStructuredFields(typeAllowChildren, fields, maxDepth);
      }).throw();
    });

    it('should throw an error if a parent has not the appropriate type', () => {
      var
        maxDepth = 3,
        typeAllowChildren = ['object'],
        fields = {
          1: [{path: ['aField'], type: 'string'}, {path: ['anotherField'], type: 'object'}],
          2: [{path: ['aField', 'aSubField'], type: 'object'}, {path: ['aField', 'anotherSubField'], type: 'object'}]
        };

      should(() => {
        curateStructuredFields(typeAllowChildren, fields, maxDepth);
      }).throw();
    });
  });

  describe('#getParent', () => {
    var
      getParent = Validation.__get__('getParent');

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

      should(() => {
        getParent(structuredField, fieldPath);
      }).throw();
    });
  });

  describe('#manageErrorMessage', () => {
    var
      manageErrorMessage = Validation.__get__('manageErrorMessage');

    it('should throw an error if verbose is false and context is not document', () => {
      var
        context = ['aField', 'aSubField'],
        verbose = false,
        message = 'a message',
        errorHolder = [];

      should(() => {
        manageErrorMessage(context, errorHolder, message, verbose);
      }).throw('Field aField.aSubField: a message');
    });

    it('should add a message at the begining of the errorHolder when verbose is false and context is document', () => {
      var
        context = 'document',
        verbose = false,
        message = 'a message',
        errorHolder = ['an existing message'];

      should(() => {
        manageErrorMessage(context, errorHolder, message, verbose);
      }).throw('Document: a message');
    });

    it('should add a message in the errorHolder in a verbose way when verbose is true and context is not document', () => {
      var
        context = ['aField', 'aSubField'],
        verbose = true,
        message = 'a message',
        errorHolder = {},
        expectedErrorHolder = {
          fieldScope: {
            children: {
              aField: {
                children: {
                  aSubField: {
                    messages: ['a message']
                  }
                }
              }
            }
          }
        };

      manageErrorMessage(context, errorHolder, message, verbose);

      should(errorHolder).be.deepEqual(expectedErrorHolder);
    });

    it('should add a message in the errorHolder in a verbose way when verbose is true and context is not document', () => {
      var
        context = ['aField', 'aSubField'],
        verbose = true,
        message = 'a message',
        errorHolder = {
          fieldScope: {
            children: {
              aField: {
                children: {
                  aSubField: {
                    messages: ['an existing message']
                  }
                }
              }
            }
          }
        },
        expectedErrorHolder = {
          fieldScope: {
            children: {
              aField: {
                children: {
                  aSubField: {
                    messages: ['an existing message', 'a message']
                  }
                }
              }
            }
          }
        };

      manageErrorMessage(context, errorHolder, message, verbose);

      should(errorHolder).be.deepEqual(expectedErrorHolder);
    });

    it('should add a message in the errorHolder in a verbose way when verbose is true and context is not document', () => {
      var
        context = ['aField', 'aSubField'],
        verbose = true,
        message = 'a message',
        errorHolder = {
          fieldScope: {
            children: {
              aField: {
                children: {
                  anotherSubField: {
                    messages: ['an existing message']
                  }
                },
                messages: ['another existing message']
              }
            }
          }
        },
        expectedErrorHolder = {
          fieldScope: {
            children: {
              aField: {
                children: {
                  aSubField: {
                    messages: ['a message']
                  },
                  anotherSubField: {
                    messages: ['an existing message']
                  }
                },
                messages: ['another existing message']
              }
            }
          }
        };

      manageErrorMessage(context, errorHolder, message, verbose);

      should(errorHolder).be.deepEqual(expectedErrorHolder);
    });

    it('should add the message in the documentScope of the errorHolder when verbose is true and context is document', () => {
      var
        context = 'document',
        verbose = true,
        message = 'a message',
        errorHolder = {},
        expectedErrorHolder = {
          documentScope: ['a message']
        };

      manageErrorMessage(context, errorHolder, message, verbose);

      should(errorHolder).be.deepEqual(expectedErrorHolder);
    });

    it('should add the message in the documentScope of the errorHolder when verbose is true and context is document', () => {
      var
        context = 'document',
        verbose = true,
        message = 'a message',
        errorHolder = {
          documentScope: ['an existing message']
        },
        expectedErrorHolder = {
          documentScope: ['an existing message', 'a message']
        };

      manageErrorMessage(context, errorHolder, message, verbose);

      should(errorHolder).be.deepEqual(expectedErrorHolder);
    });
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
      kuzzle.internalEngine.search = sandbox.stub().returns(Promise.resolve({hits: []}));

      return getValidationConfiguration(kuzzle)
        .then(result => {
          should(result).be.deepEqual(kuzzle.config.validation);
          should(kuzzle.internalEngine.search.callCount).be.eql(1);
          should(kuzzle.internalEngine.search.args[0][0]).be.eql('validations');
        });
    });

    it('should return an empty object if nothing is returned from internal engine and there is no configuration', () => {
      delete kuzzle.config.validation;
      kuzzle.internalEngine.search = sandbox.stub().returns(Promise.resolve({hits: []}));

      return getValidationConfiguration(kuzzle)
        .then(result => {
          should(result).be.deepEqual({});
        });
    });

    it('should return a well formed configuration when getting results from internal engine', () => {
      var
        internalEngineResponse = {
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
        },
        expectedConfiguration = {
          anIndex: {
            aCollection: 'validation1',
            anotherCollection: 'validation2'
          },
          anotherIndex: {
            aCollection: 'validation3',
            anotherCollection: 'validation4'
          }
        };

      kuzzle.internalEngine.search = sandbox.stub().returns(Promise.resolve(internalEngineResponse));

      return getValidationConfiguration(kuzzle)
        .then(result => {
          should(result).be.deepEqual(expectedConfiguration);
        });
    });
  });
});
