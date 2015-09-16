var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

require('should-promised');

describe('Test: dsl.removeRoomFromFields', function () {
  var
    dsl,
    removeRoomFromFields = Dsl.__get__('removeRoomFromFields');

  beforeEach(function () {
    dsl = new Dsl();
  });

  it('should do nothing if no filters are provided', function () {
    return should(removeRoomFromFields.call(dsl, {})).be.fulfilled();
  });
});
