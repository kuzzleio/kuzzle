var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test bool method', function () {

  var
    roomId = 'roomId',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      age: 85,
      city: 'NYC',
      hobby: 'computer'
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      age: 36,
      city: 'London',
      hobby: 'computer'
    },
    filter = {
      "must" : [
        {
          "terms" : {
            "firstName" : ["Grace", "Ada"]
          }
        },
        {
          "range": {
            "age": {
              "gte": 36,
              "lt": 85
            }
          }
        }
      ],
      "must_not" : [
        {
          "term": {
            "city": "NYC"
          }
        }
      ],
      "should" : [
        {
          "term" : {
            "hobby" : "computer"
          }
        },
        {
          "exists" : {
            "field" : "lastName"
          }
        }
      ]
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.bool(roomId, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty;
    should(methods.dsl.filtersTree[collection]).not.be.empty;

    should(methods.dsl.filtersTree[collection].firstName).not.be.empty;
    should(methods.dsl.filtersTree[collection].age).not.be.empty;
    should(methods.dsl.filtersTree[collection].city).not.be.empty;
    should(methods.dsl.filtersTree[collection].hobby).not.be.empty;
    should(methods.dsl.filtersTree[collection].lastName).not.be.empty;
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Ada']).not.be.empty;

    should(methods.dsl.filtersTree[collection].age.rangeagegte36).not.be.empty;
    should(methods.dsl.filtersTree[collection].age.rangeagelt85).not.be.empty;

    should(methods.dsl.filtersTree[collection].city.nottermcityNYC).not.be.empty;
    should(methods.dsl.filtersTree[collection].hobby.termhobbycomputer).not.be.empty;
    should(methods.dsl.filtersTree[collection].lastName.existslastName).not.be.empty;
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Ada'].rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].age.rangeagegte36.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
    rooms = methods.dsl.filtersTree[collection].age.rangeagelt85.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].city.nottermcityNYC.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].hobby.termhobbycomputer.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].lastName.existslastName.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);


  });

  it('should construct the filterTree with correct functions match', function () {
    var result;

    result = methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Ada'].fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Ada'].fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].age.rangeagegte36.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].age.rangeagegte36.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].age.rangeagelt85.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].age.rangeagelt85.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].city.nottermcityNYC.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].city.nottermcityNYC.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].hobby.termhobbycomputer.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].hobby.termhobbycomputer.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].lastName.existslastName.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].lastName.existslastName.fn(documentAda);
    should(result).be.exactly(true);

  });

});