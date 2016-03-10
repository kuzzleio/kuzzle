var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
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

  describe('#isActionValid', (callback) => {
    it('should disallow any action when no matching entry can be found', function () {
      var
        role = new Role();

      role.indexes = {
        index: {
          collections: {
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

      role.isActionAllowed(requestObject, context)
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes.index.collections.collection.controllers.controller.actions;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes.index.collections.collection.controllers.controller;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes.index.collections.collection.controllers;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes.index.collections.collection;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes.index.collections;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes.index;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.indexes;
          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
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

      return should(role.isActionAllowed(requestObject, context)).be.fulfilledWith(true);
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

      return should(role.isActionAllowed(requestObject, context)).be.fulfilledWith(true);
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

      return should(role.isActionAllowed(rq, context)).be.fulfilledWith(false);
    });

    it('should allow/deny index creation according to indexes._canCreate right', function (callback) {
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

      roleAllow.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(rq, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should allow/deny collection creation according to index._canCreate right', function (callback) {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        rq = {
          controller: 'admin',
          action: 'createCollection'
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

      roleAllow.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(rq, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should allow/deny collection creation according to collection._canCreate right', function (callback) {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        rq = {
          controller: 'admin',
          action: 'createCollection'
        };

      roleAllow.indexes = {
        '*': {
          collections: {
            '_canCreate': true,
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
          collections: {
            '_canCreate': false,
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

      roleAllow.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(rq, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should allow/deny index deletion according to indexes._canDelete right', function (callback) {
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

      roleAllow.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(rq, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should allow/deny collection deletion according to collection._canDelete right', function (callback) {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        rq = {
          controller: 'admin',
          action: 'deleteCollection'
        };

      roleAllow.indexes = {
        '*': {
          collections: {
            '*': {
              '_canDelete': true,
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
          collections: {
            '*': {
              '_canDelete': false,
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

      roleAllow.isActionAllowed(rq, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(rq, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
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

      return should(role.isActionAllowed(rq, context)).be.fulfilledWith(false);
    });

    it('should properly handle overridden permissions', function (callback) {
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

      role.isActionAllowed(requestObject, context)
        .then(isAllowed => {
          should(isAllowed).be.false();

          role.indexes.index.collections['*'].controllers['*'].actions.action = true;

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();

          role.indexes.index.collections['*'].controllers.controller = {
            actions: {
              '*': false
            }
          };

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          role.indexes.index.collections['*'].controllers.controller.actions.action = true;

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();

          role.indexes.index.collections.collection = {
            controllers: {
              '*': {
                actions: {
                  '*': false
                }
              }
            }
          };

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          role.indexes.index.collections.collection.controllers.controller = {
            actions: {
              '*': true
            }
          };

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();

          role.indexes.index.collections.collection.controllers.controller.actions.action = false;

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
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

      should(role.isActionAllowed(requestObject, context)).be.rejected();
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

      should(function () {
        role.isActionAllowed(requestObject, context);
      }).throw(InternalError);
    });

    it('should handle a custom right function', function (callback) {
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
                    '*': {
                      args: {},
                      test: 'return $requestObject.action === \'action\'; '
                    }
                  }
                }
              }
            }
          }
        }
      };

      role.isActionAllowed(requestObject, context)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return role.isActionAllowed(noMatchRequestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          role.closures = {};
          role.indexes['*'].collections['*'].controllers['*'].actions['*'] = {
            args: {},
            test: 'return $requestObject.action !== \'action\'; '
          };

          return role.isActionAllowed(requestObject, context);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          callback();
        });
    });

    it('should allow/deny rights using custom function with args using get', function (callback) {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        kuzzle = {
          services: {
            list: {
              readEngine: {
                get: function (requestObject) {
                  if (requestObject.data.id !== 'foobar') {
                    return q(new ResponseObject(requestObject, documentAda));
                  } else {
                    return q(new ResponseObject(requestObject, documentFalseAda));
                  }
                }
              }
            }
          }
        };

      roleAllow.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
            }
          }
        }
      };

      roleDeny.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
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


      roleAllow.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(requestObject, context, {}, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should allow/deny rights using custom function with args using mget', function (callback) {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        kuzzle = {
          services: {
            list: {
              readEngine: {
                mget: function (requestObject) {
                  if (requestObject.data.body.ids[0] !== 'foobar') {
                    return q(new ResponseObject(requestObject, {hits: [documentAda]}));
                  } else {
                    return q(new ResponseObject(requestObject, {hits: [documentFalseAda]}));
                  }
                }
              }
            }
          }
        };

      roleAllow.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
            }
          }
        }
      };

      roleDeny.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
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


      roleAllow.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(requestObject, context, {}, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should allow/deny rights using custom function with args using search', function (callback) {
      var
        roleAllow = new Role(),
        roleDeny = new Role(),
        kuzzle = {
          services: {
            list: {
              readEngine: {
                search: function (requestObject) {
                  if (requestObject.data.body.filter.ids.values[0] !== 'foobar') {
                    return q(new ResponseObject(requestObject, {hits: [documentAda]}));
                  } else {
                    return q(new ResponseObject(requestObject, {hits: [documentFalseAda]}));
                  }
                }
              }
            }
          }
        };

      roleAllow.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
            }
          }
        }
      };

      roleDeny.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
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


      roleAllow.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return roleDeny.isActionAllowed(requestObject, context, {}, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should not allow bad method call', function (callback) {
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
                    return q(new ResponseObject(requestObject, documentAda));
                  } else {
                    return q(new ResponseObject(requestObject, documentFalseAda));
                  }
                }
              }
            }
          }
        };

      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
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


      role.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
    });

    it('should not allow if read method throws an error', function () {
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
                  throw(new InternalError('Error'));
                }
              }
            }
          }
        };

      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
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


      should(function () {
        role.isActionAllowed(requestObject, context, {}, kuzzle);
      }).throw(InternalError);
    });

    it('should not allow if collection is not specified', function (callback) {
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
                    return q(new ResponseObject(requestObject, documentAda));
                  } else {
                    return q(new ResponseObject(requestObject, documentFalseAda));
                  }
                }
              }
            }
          }
        };

      role.indexes = {
        '*': {
          collections: {
            '*': {
              controllers: {
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
              }
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


      role.isActionAllowed(requestObject, context, {}, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.false();

          callback();
        });
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

    it('should reject the promise if the action right is neither a boolean or an object', () => {
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

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for index,collection,controller,action. Must be a boolean or an object'});
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
                        action: {
                          args: {},
                          test: 'a string'
                        }
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
                        action: {
                          args: {},
                          test: 'a string'
                        }
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
                        action: {
                          args: {},
                          test: 'a string'
                        }
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

