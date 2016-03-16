var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  Role = rewire('../../../../../lib/api/core/models/security/role'),
  internalIndex = require('rc')('kuzzle').internalIndex;

describe('Test: security/roleTest', function () {
  var
    context = {
      connection: {type: 'test'},
      user: null
    },
    requestObject = {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    };

  describe('#isActionValid', () => {
    it('should disallow any action when no matching entry can be found', function () {
      var
        role = new Role();

      role.indexes = {
        index: {
          collections: {
            collection: {
              controllers: {
                controller: {
                  actions: {
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes.index.collections.collection.controllers.controller.actions;
      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes.index.collections.collection.controllers.controller;
      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes.index.collections.collection.controllers;
      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes.index.collections.collection;
      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes.index.collections;
      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes.index;
      should(role.isActionAllowed(requestObject, context)).be.false();

      delete role.indexes;
      should(role.isActionAllowed(requestObject, context)).be.false();
    });

    it('should allow an action explicitely set to true', function () {
      var role = new Role();

      role.indexes = {
        index: {
          collections: {
            collection: {
              controllers: {
                controller: {
                  actions: {
                    action: true
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(requestObject, context)).be.true();
    });

    it('should allow a wildcard action', function () {
      var role = new Role();
      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(requestObject, context)).be.true();
    });

    it('should not allow security actions when the internal index is not set explicitly', function () {
      var
        role = new Role(),
        rq = {
          controller: 'security',
          action: 'some security action'
        };

      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(rq, context)).be.false();
    });

    it('should allow/deny index creation according to indexes._canCreate right', function () {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        rq = {
          controller: 'admin',
          action: 'createIndex'
        };

      roleAllow.indexes = {
        '_canCreate': true,
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      roleDeny.indexes = {
        '_canCreate': false,
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      should(roleAllow.isActionAllowed(rq, context)).be.true();
      should(roleDeny.isActionAllowed(rq, context)).be.false();
    });

    it('should allow/deny index deletion according to indexes._canDelete right', function () {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        rq = {
          controller: 'admin',
          action: 'deleteIndex'
        };

      roleAllow.indexes = {
        '*': {
          '_canDelete': true,
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      roleDeny.indexes = {
        '*': {
          '_canDelete': false,
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      should(roleAllow.isActionAllowed(rq, context)).be.true();
      should(roleDeny.isActionAllowed(rq, context)).be.false();
    });

    it('should not allow any action on the internal index if no role has been explicitly set on it', function () {
      var
        role = new Role(),
        rq = {
          index: internalIndex,
          collection: 'collection',
          controller: 'controller',
          action: 'action'
        };

      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(rq, context)).be.false();
    });

    it('should properly handle overridden permissions', function () {
      var role = new Role();
      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            }
          }
        },
        index: {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': false
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(requestObject, context)).be.false();

      role.indexes.index.collections['*'].controllers['*'].actions.action = true;
      should(role.isActionAllowed(requestObject, context)).be.true();

      role.indexes.index.collections['*'].controllers.controller = {
        actions: {
          '*': false
        }
      };
      should(role.isActionAllowed(requestObject, context)).be.false();

      role.indexes.index.collections['*'].controllers.controller.actions.action = true;
      should(role.isActionAllowed(requestObject, context)).be.true();

      role.indexes.index.collections.collection = {
        controllers: {
          '*': {
            actions: {
              '*': false
            }
          }
        }
      };
      should(role.isActionAllowed(requestObject, context)).be.false();

      role.indexes.index.collections.collection.controllers.controller = {
        actions: {
          '*': true
        }
      };
      should(role.isActionAllowed(requestObject, context)).be.true();

      role.indexes.index.collections.collection.controllers.controller.actions.action = false;
      should(role.isActionAllowed(requestObject, context)).be.false();
    });

    it('should throw an error if the rights configuration is not either a boolean or a function', function () {
      var role = new Role();
      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': {an: 'object'}
                  }
                }
              }
            }
          }
        }
      };

      should(function () { role.isActionAllowed(requestObject, context); }).throw(InternalError);
    });

    it('should throw an error if an invalid function is given', function () {
      var role = new Role();
      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': '(some invalid code'
                  }
                }
              }
            }
          }
        }
      };

      should(function () { role.isActionAllowed(requestObject, context); }).throw(InternalError);
    });

    it('should handle a custom right function', function () {
      var
        role = new Role(),
        noMatchRequestObject = {
          collection: 'collection',
          controller: 'controller',
          action: 'noaction'
        };

      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
                '*': {
                  actions: {
                    '*': 'return requestObject.action === \'action\'; '
                  }
                }
              }
            }
          }
        }
      };

      should(role.isActionAllowed(requestObject, context)).be.true();
      should(role.isActionAllowed(noMatchRequestObject, context)).be.false();

      role.closures = {};
      role.indexes['*'].collections['*'].controllers['*'].actions['*'] = 'return requestObject.action !== \'action\'; ';
      should(role.isActionAllowed(requestObject, context)).be.false();

    });

  });

  describe('#validateDefinition', () => {
    it('should reject the promise if the index is not an object', () => {
      var role = new Role();
      role.indexes = true;

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'The index definition must be an object'});
    });

    it('should reject the promise if the index definition is empty', () => {
      var role = new Role();
      role.indexes = {};

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'The index definition cannot be empty'});
    });

    it('should reject the promise if the index element is not an object', () => {
      var role = new Role();
      role.indexes = {
        '*': true
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid index definition for *. Must be an object'});
    });

    it('should reject the promise if the index element is empty', () => {
      var role = new Role();
      role.indexes = {
        '*': {}
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid index definition for *. Cannot be empty'});
    });

    it('should reject the promise if the collections attribute is missing from the index element', () => {
      var role = new Role();
      role.indexes = {
        '*': {
          wrongAttribute: true
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid index definition for *. `collections` attribute missing'});
    });

    it('should reject the promise if the collections attribute is not an object', () => {
      var role = new Role();
      role.indexes = {
        '*': {
          collections: true
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid index definition for *. `collections` attribute must be an object'});
    });

    it('should reject the promise if the collections attribute is empty', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        '*': {
          collections: {}
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid index definition for *. `collections` attribute cannot be empty'});
    });

    it('should reject the promise if the collection element is not an object', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        '*': {
          collections: {
            invalid: true
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for *,invalid. Must be an object'});
    });

    it('should reject the promise if the collection element is empty', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        '*': {
          collections: {
            invalid: {}
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for *,invalid. Cannot be empty'});
    });

    it('should reject the promise if the controllers attribute is missing', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              a: true
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection. `controllers` attribute missing'});
    });

    it('should reject the promise is the controllers attribute is not an object', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: true
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection. `controllers` attribute must be an object'});
    });

    it('should reject the promise if the controllers attribute is empty', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {}
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection. `controllers` attribute cannot be empty'});
    });

    it('should reject the promise is the controller element is not an object', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller: true
              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller. Must be an object'});
    });

    it('should reject the promise if the controller element is empty', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller: {}
              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller. Cannot be empty'});
    });

    it('should reject the promise if the actions attribute is missing', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller: {
                  a: true
                }
              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller. `actions` attribute missing'});
    });

    it('should reject the promise is the actions attribute is not an object', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller: {
                  actions: true
                }
              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller. `actions` attribute must be an object'});
    });

    it('should reject the promise if the actions attribute is empty', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller: {
                  actions: {}
                }
              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller. `actions` attribute cannot be empty'});
    });

    it('should reject the promise if the action right is neither a boolean or a string', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller: {
                  actions: {
                    action: null
                  }
                }
              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller,action. Must be a boolean or a string'});
    });

    it('should reject if _canCreate is not boolean in indexes', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: {},
        index1: {
          collections: {
            _canCreate: true,
            collection1: {
              controllers: {
                controller: {
                  actions: {
                    action1: false,
                    action2: true
                  }
                }

              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith('Invalid index definition for _canCreate. Must be an boolean');
    });

    it('should reject if _canCreate is not boolean in collections', () => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index1: {
          collections: {
            _canCreate: {},
            collection1: {
              controllers: {
                controller: {
                  actions: {
                    action1: false,
                    action2: true
                  }
                }

              }
            }
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith('Invalid index definition for index1,_canCreate. Must be an boolean');
    });

    it('should validate if only boolean rights are given', done => {
      var role = new Role();
      role.indexes = {
        _canCreate: true,
        index1: {
          collections: {
            _canCreate: true,
            collection1: {
              controllers: {
                controller: {
                  actions: {
                    action1: false,
                    action2: true
                  }
                }

              }
            },
            collection2: {
              controllers: {
                controller: {
                  actions: {
                    action: true
                  }
                }
              }
            }
          }
        },
        index2: {
          collections: {
            _canCreate: true,
            collection: {
              controllers: {
                controller1: {
                  actions: {
                    action: true
                  }
                },
                controller2: {
                  actions: {
                    action: false
                  }
                }
              }
            }
          }
        }
      };

      role.validateDefinition(context)
        .then(result => {
          should(result).be.a.Boolean();
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should reject the promise if the sandbox thew an error', () => {
      var foo =
        Role.__with__({
          Sandbox: function () {
            this.run = function (data) {
              return q.reject(new Error('our unit test error'));
            };
          }
        })(() => {
          var role = new Role();

          role.indexes = {
            _canCreate: true,
            index: {
              collections: {
                _canCreate: true,
                collection: {
                  controllers: {
                    controller: {
                      actions: {
                        action: 'a string'
                      }
                    }
                  }
                }
              }
            }
          };

          return role.validateDefinition(context);
        });

      return should(foo).be.rejectedWith(Error, {message: 'our unit test error'});
    });


    it('should reject the promise if the sandbox does not resolve to a boolean', () => {
      var foo =
        Role.__with__({
          Sandbox: function () {
            this.run = function (data) {
              return q({
                result: 'I am not a boolean'
              });
            };
          }
        })(() => {
          var role = new Role();
          role.indexes = {
            _canCreate: true,
            index: {
              collections: {
                _canCreate: true,
                collection: {
                  controllers: {
                    controller: {
                      actions: {
                        action: 'a string'
                      }
                    }
                  }
                }
              }
            }
          };

          return role.validateDefinition(context);
        });

      return should(foo).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller,action. Error executing function'});
    });

    it('should resolve the promise if the sandbox returned a boolean', done => {
      var foo =
        Role.__with__({
          Sandbox: function () {
            this.run = function (data) {
              return q({ result: true });
            };
          }
        })(() => {
          var role = new Role();
          role.indexes = {
            _canCreate: true,
            index: {
              collections: {
                _canCreate: true,
                collection: {
                  controllers: {
                    controller: {
                      actions: {
                        action: 'a string'
                      }
                    }
                  }
                }
              }
            }
          };

          return role.validateDefinition(context);
        })
        .then(result => {
          should(result).be.true();
          done();
        })
        .catch(error => {
          done(error);
        });

    });

  });

});

