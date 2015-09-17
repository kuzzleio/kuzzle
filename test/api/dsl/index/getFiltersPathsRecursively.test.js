var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.getFiltersPathsRecursively', function () {
  var
    getFiltersPathsRecursively = Dsl.__get__('getFiltersPathsRecursively');

  it('should be able to construct a filter path out of a complex filter', function () {
    var
      filter = {
        and: {
          'message.subject.Potayto': undefined,
          or: {
            and: {
              'message.subject.Potahto': undefined,
              'message.subject.MisterSandman': undefined
            },
            'message.subject.BringUsADream': undefined
          }
        }
      },
      result = getFiltersPathsRecursively(filter);

    should(result).be.an.Array();
    should(result.length).be.exactly(4);
    should(result.indexOf('message.subject.Potayto')).not.be.eql(-1);
    should(result.indexOf('message.subject.Potahto')).not.be.eql(-1);
    should(result.indexOf('message.subject.MisterSandman')).not.be.eql(-1);
    should(result.indexOf('message.subject.BringUsADream')).not.be.eql(-1);
  });
});
