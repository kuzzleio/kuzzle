var
  should = require('should'),
  Policies = require.main.require('lib/api/core/models/security/policies');


describe('Test: security/policiesTest', () => {

  it('should correclty merge policies', () => {
    var
      result;

    result = Policies.merge(undefined, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge(undefined, {value: true});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'allowed'}, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'allowed'}, {value: true});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: true}, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: true}, {value: true});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'conditional'}, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'conditional'}, {value: true});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: {foo: 'bar'}}, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: {foo: 'bar'}}, {value: true});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'denied'}, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'denied'}, {value: true});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'foobar'}, {value: 'allowed'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'foobar'}, {value: true});
    should(result.value).be.equal('allowed');

    result = Policies.merge(undefined, {value: 'conditional'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'allowed'}, {value: 'conditional'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: true}, {value: 'conditional'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'conditional'}, {value: 'conditional'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: {foo: 'bar'}}, {value: 'conditional'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'denied'}, {value: 'conditional'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'foobar'}, {value: 'conditional'});
    should(result.value).be.equal('conditional');

    result = Policies.merge(undefined, {value: {foo: 'bar'}});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'allowed'}, {value: {foo: 'bar'}});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: true}, {value: {foo: 'bar'}});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'conditional'}, {value: {foo: 'bar'}});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: {foo: 'bar'}}, {value: {foo: 'bar'}});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'denied'}, {value: {foo: 'bar'}});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'foobar'}, {value: {foo: 'bar'}});
    should(result.value).be.equal('conditional');

    result = Policies.merge(undefined, {value: 'denied'});
    should(result.value).be.equal('denied');
    result = Policies.merge({value: 'allowed'}, {value: 'denied'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: true}, {value: 'denied'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'conditional'}, {value: 'denied'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: {foo: 'bar'}}, {value: 'denied'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'denied'}, {value: 'denied'});
    should(result.value).be.equal('denied');
    result = Policies.merge({value: 'foobar'}, {value: 'denied'});
    should(result.value).be.equal('denied');

    result = Policies.merge(undefined, {value: 'foobar'});
    should(result.value).be.equal('denied');
    result = Policies.merge({value: 'allowed'}, {value: 'foobar'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: true}, {value: 'foobar'});
    should(result.value).be.equal('allowed');
    result = Policies.merge({value: 'conditional'}, {value: 'foobar'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: {foo: 'bar'}}, {value: 'foobar'});
    should(result.value).be.equal('conditional');
    result = Policies.merge({value: 'denied'}, {value: 'foobar'});
    should(result.value).be.equal('denied');
    result = Policies.merge({value: 'foobar'}, {value: 'foobar'});
    should(result.value).be.equal('denied');
  });
});
