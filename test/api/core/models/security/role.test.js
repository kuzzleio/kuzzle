var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  ParseError = require.main.require('lib/api/core/errors/parseError'),
  Role = rewire('../../../../../lib/api/core/models/security/role'),
  internalIndex = require('rc')('kuzzle').internalIndex;

describe('Test: security/roleTest', function () {
  var
    context = {
      connection: {type: 'test'},
      token : {
        user: {
          _id: -1
        }
      }
    },
    requestObject = {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    },
    documentAda = {
      _id: 'ada',
      found: true,
      _version: 1,
      _index: 'bar',
      _type: 'barbar',
      _source: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'London',
        hobby: 'computer'
      }
    },
    documentFalseAda = {
      _id: 'foobar',
      found: true,
      _version: 1,
      _index: 'bar',
      _type: 'barbar',
      _source: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'London',
        hobby: 'computer'
      }
    };

  describe('#isActionAllowed', () => {
    it('should disallow any action when no matching entry can be found', function () {
      var
        role = new Role();

      role.controllers = {
        controller: {
          actions: {}
        }
      };

      return role.isActionAllowed(requestObject, context)
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.controllers.controller.actions;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.controllers.controller;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.controllers;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });

    });

    it('should allow an action explicitely set to true', function () {
      var role = new Role();

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      return should(role.isActionAllowed(requestObject, context)).be.fulfilledWith(true);
    });

    it('should allow a wildcard action', function () {
      var role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        }
      };

      return should(role.isActionAllowed(requestObject, context)).be.fulfilledWith(true);
    });

    it('should properly handle restrictions', function (callback) {
      var
        role = new Role(),
        rq = {
          index: 'index',
          collection: 'collection',
          controller: 'controller',
          action: 'action'
        },
        restrictions = [
          {index: 'index1'},
          {index: 'index2', collections: ['collection1']},
          {index: 'index3', collections: ['collection1', 'collection2']}
        ];

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      role.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.true();
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          rq.index = 'index1';
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          rq.index = 'index2';
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          rq.collection = 'collection1';
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          rq.collection = 'collection2';
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          rq.index = 'index3';
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          callback();
        })
        .catch(err => {
          callback(err);
        });
    });

    it('should not allow any action on the internal index if no role has been explicitly set on it', function (callback) {
      var
        role = new Role(),
        rq = {
          index: internalIndex,
          collection: 'collection',
          controller: 'controller',
          action: 'action'
        },
        restrictions = [
          {index: 'aaa', collections: ['aaa', 'bbb']}
        ];

      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        }
      };

      role.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.false();
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          restrictions.push({index: '%kuzzle'});
          return role.isActionAllowed(rq, context, restrictions);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          callback();
        })
        .catch(err => {
          callback(err);
        });
    });

    it('should properly handle overridden permissions', function () {
      var role = new Role();
      role.controllers = {
          '*': {
            actions: {
              '*': true
            }
          },
          controller: {
            actions: {
              '*': false
            }
          }
        };

      return role.isActionAllowed(requestObject, context)
        .then(isAllowed => {
          should(isAllowed).be.false();
          role.controllers.controller.actions.action = true;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          role.controllers.controller.actions.action = false;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });
    });

    it('should throw an error if the rights configuration is not either a boolean or a closure', function () {
      var role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': {an: 'object'}
          }
        }
      };

      should(role.isActionAllowed(requestObject, context)).be.rejected();
    });

    it('should throw an error if an invalid function is given', function () {
      var role = new Role(),
        kuzzle = {
          pluginsManager: {
            trigger: () => {
              return true;
            }
          },
          services: {
            list: {
              readEngine: {
                search: function (requestObject) {
                  if (requestObject.data.body.filter.ids.values[0] !== 'foobar') {
                    return q({hits: [documentAda]});
                  }

                  return q({hits: [documentFalseAda]});
                }
              }
            }
          }
        };

      role.controllers = {
        '*': {
          actions: {
            '*': {
              test: '(some invalid code',
              args: {}
            }
          }
        }
      };

      return should(role.isActionAllowed(requestObject, context, {}, kuzzle)).be.rejectedWith(ParseError);
    });

    it('should throw an error if an invalid argument is given', () => {
      var role = new Role(),
        kuzzle = {
          pluginsManager: {
            trigger: () => true
          },
          services: {
            list: {
              readEngine: {
                search: rq => {
                  if (rq.data.body.filter.ids.values[0] !== 'foobar') {
                    return q({hits: [documentAda]});
                  }

                  return q({hits: [documentFalseAda]});
                }
              }
            }
          }
        };

      role.controllers = {
        '*': {
          actions: {
            '*': {
              test: '(some invalid code',
              args: {
                document: {
                  get: '$requestObject.data..id'
                }
              }
            }
          }
        }
      };

      return should(() => role.isActionAllowed(requestObject, context, {}, kuzzle)).throw(ParseError);
    });

    it('should handle a custom right function', function () {
      var
        role = new Role(),
        noMatchRequestObject = {
          collection: 'collection',
          controller: 'controller',
          action: 'noaction'
        };

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {},
              test: 'return $requestObject.action === \'action\'; '
            }
          }
        }
      };

      return role.isActionAllowed(requestObject, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return role.isActionAllowed(noMatchRequestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          role.closures = {};
          role.controllers['*'].actions['*'] = {
            args: {},
            test: 'return $requestObject.action !== \'action\'; '
          };

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });
    });

    it('should allow/deny rights using custom function with args using get', () => {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        kuzzle = {
          services: {
            list: {
              readEngine: {
                get: function (requestObject) {
                  if (requestObject.data.id !== 'foobar') {
                    return q(documentAda);
                  }

                  return q(documentFalseAda);
                }
              }
            }
          }
        };

      roleAllow.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: '$currentId'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $requestObject.data._id;'
            }
          }
        }
      };

      roleDeny.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: 'foobar'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $requestObject.data._id;'
            }
          }
        }
      };

      var requestObject = new RequestObject({
        controller: 'read',
        action: 'get',
        requestId: 'foo',
        collection: 'barbar',
        index: 'bar',
        body: {
          _id: documentAda._id
        }
      });


      return roleAllow.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(requestObject, context, {}, kuzzle);
        })
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should allow/deny rights using custom function with args using mget', function () {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        kuzzle = {
          services: {
            list: {
              readEngine: {
                mget: function (requestObject) {
                  if (requestObject.data.body.ids[0] !== 'foobar') {
                    return q({hits: [documentAda]});
                  }

                  return q({hits: [documentFalseAda]});
                }
              }
            }
          }
        },
        requestObject = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          body: {
            _id: documentAda._id
          }
        });

      roleAllow.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                documents: {
                  action: {
                    mget: ['$currentId']
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.documents[0] && args.documents[0].id === $requestObject.data._id;'
            }
          }
        }
      };

      roleDeny.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                documents: {
                  action: {
                    mget: ['foobar']
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.documents[0] && args.documents[0].id === $requestObject.data._id;'
            }
          }
        }
      };

      return roleAllow.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(requestObject, context, {}, kuzzle);
        })
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should allow/deny rights using custom function with args using search', () => {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        kuzzle = {
          services: {
            list: {
              readEngine: {
                search: function (requestObject) {
                  if (requestObject.data.body.filter.ids.values[0] !== 'foobar') {
                    return q({hits: [documentAda]});
                  }

                  return q({hits: [documentFalseAda]});
                }
              }
            }
          }
        },
        requestObject = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          body: {
            _id: documentAda._id
          }
        });

      roleAllow.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                documents: {
                  action: {
                    search: {
                      filter: {
                        ids: {
                          values: [
                            '$requestObject.data._id'
                          ]
                        }
                      }
                    }
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.documents[0] && args.documents[0].id === $requestObject.data._id;'
            }
          }
        }
      };

      roleDeny.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                documents: {
                  action: {
                    search: {
                      filter: {
                        ids: {
                          values: [
                            'foobar'
                          ]
                        }
                      }
                    }
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.documents[0] && args.documents[0].id === $requestObject.data._id;'
            }
          }
        }
      };

      return roleAllow.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(requestObject, context, {}, kuzzle);
        })
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should not allow bad method call', () => {
      var
        role = new Role(),
        kuzzle = {
          pluginsManager: {
            trigger: () => {
              return true;
            }
          },
          services: {
            list: {
              readEngine: {
                get: function (requestObject) {
                  if (requestObject.data.id !== 'foobar') {
                    return q(documentAda);
                  }

                  return q(documentFalseAda);
                }
              }
            }
          }
        },
        requestObject = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          body: {
            _id: documentAda._id
          }
        });

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    foo: '$currentId'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $requestObject.data._id;'
            }
          }
        }
      };

      return role.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should not allow if read method throws an error', () => {
      var
        role = new Role(),
        kuzzle = {
          pluginsManager: {
            trigger: () => true
          },
          services: {
            list: {
              readEngine: {
                get: () => q.reject(new InternalError('Our Error'))
              }
            }
          }
        },
        requestObject = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          body: {
            _id: documentAda._id
          }
        });

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: '$currentId'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $requestObject.data._id;'
            }
          }
        }
      };

      return role.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isActionAllowed => should(isActionAllowed).be.false());
    });

    it('should not allow if collection is not specified', () => {
      var
        role = new Role(),
        kuzzle = {
          pluginsManager: {
            trigger: () => {
              return true;
            }
          },
          services: {
            list: {
              readEngine: {
                get: (requestObject) => {
                  if (requestObject.data.id !== 'foobar') {
                    return q(documentAda);
                  }

                  return q(documentFalseAda);
                }
              }
            }
          }
        },
        requestObject = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          body: {
            _id: documentAda._id
          }
        });

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: '$currentId'
                  },
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $requestObject.data._id;'
            }
          }
        }
      };

      return role.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => should(isAllowed).be.false());
    });
  });

  describe('#validateDefinition', () => {
    it('should reject the promise if the controllers definition is not an object', () => {
      var role = new Role();
      role.controllers = true;

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'The "controllers" definition must be an object'});
    });

    it('should reject the promise if the controllers definition is empty', () => {
      var role = new Role();
      role.controllers = {};

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'The "controllers" definition cannot be empty'});
    });

    it('should reject the promise if the controller element is not an object', () => {
      var role = new Role();
      role.controllers = {
        '*': true
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for *. Must be an object'});
    });

    it('should reject the promise if the controller element is empty', () => {
      var role = new Role();
      role.controllers = {
        '*': {}
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for *. Cannot be empty'});
    });

    it('should reject the promise if the actions attribute is missing', () => {
      var role = new Role();
      role.controllers = {
        controller: {
          a: true
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for controller. `actions` attribute missing'});
    });

    it('should reject the promise is the actions attribute is not an object', () => {
      var role = new Role();
      role.controllers = {
        controller: {
          actions: true
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for controller. `actions` attribute must be an object'});
    });

    it('should reject the promise if the actions attribute is empty', () => {
      var role = new Role();
      role.controllers = {
        controller: {
          actions: {}
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for controller. `actions` attribute cannot be empty'});
    });

    it('should reject the promise if the action right is neither a boolean or an object', () => {
      var role = new Role();
      role.controllers = {
        controller: {
          actions: {
            action: null
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for controller,action. Must be a boolean or an object'});
    });

    it('should validate if only boolean rights are given', () => {
      var role = new Role();
      role.controllers = {
        controller1: {
          actions: {
            action1: false,
            action2: true
          }
        },
        controller2: {
          actions: {
            action3: true
          }
        }
      };

      return role.validateDefinition(context)
        .then(result => should(result).be.a.Boolean());
    });

    it('should reject the promise if the closure does not contain a "test" attribute', () => {
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

      return should(role.validateDefinition(context)).be.rejected();
    });

    it('should reject the promise if the sandbox thew an error', () => {
      var foo =
        Role.__with__({
          Sandbox: function () {
            this.run = () => q.reject(new Error('our unit test error'));
          }
        })(() => {
          var role = new Role();

          role.controllers = {
            controller: {
              actions: {
                action: {
                  args: {},
                  test: 'a string'
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
            this.run = () => q({result: 'I am not a boolean'});
          }
        })(() => {
          var role = new Role();
          role.controllers = {
            controller: {
              actions: {
                action: {
                  args: {},
                  test: 'a string'
                }
              }
            }
          };

          return role.validateDefinition(context);
        });

      return should(foo).be.rejectedWith(BadRequestError, {message: 'Invalid definition for controller,action. Error executing function'});
    });

    it('should resolve the promise if the sandbox returned a boolean', () => {
      return Role.__with__({
        Sandbox: function () {
          this.run = () => q({ result: true });
        }
      })(() => {
        var role = new Role();
        role.controllers = {
          controller: {
            actions: {
              action: {
                args: {},
                test: 'a string'
              }
            }
          }
        };

        return role.validateDefinition(context);
      })
      .then(result => should(result).be.true());
    });
  });
});

