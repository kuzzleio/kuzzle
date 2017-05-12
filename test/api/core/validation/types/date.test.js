'use strict';

const
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  sinon = require('sinon'),
  should = require('should');

describe('Test: validation/types/date', () => {
  'use strict';
  let
    DateType,
    dateType,
    sandbox = sinon.sandbox.create(),
    isValidStub = sandbox.stub(),
    isBeforeStub = sandbox.stub(),
    utcStub = sandbox.stub(),
    unixStub = sandbox.stub(),
    momentMock = {
      utc: utcStub,
      unix: unixStub,
      ISO_8601: 'ISO_8601'
    };

  before(() => {
    mockrequire('moment', momentMock);
    DateType = mockrequire.reRequire('../../../../../lib/api/core/validation/types/date');
  });

  beforeEach(() => {
    sandbox.reset();
    dateType = new DateType();
  });

  after(() => {
    mockrequire.stopAll();
  });

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(dateType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof dateType.typeName).be.eql('string');
    should(typeof dateType.allowChildren).be.eql('boolean');
    should(Array.isArray(dateType.allowedTypeOptions)).be.true();
    should(dateType.typeName).be.eql('date');
    should(dateType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof DateType.prototype.validate).be.eql('function');
    should(typeof DateType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    it('should return true if the date format is valid', () => {
      const
        typeOptions = {
          formats: ['epoch_millis']
        };

      momentMock.utc.returns({isValid: () => true});

      should(dateType.validate(typeOptions, '1234567890', [])).be.true();
    });

    it('should return false if the date format is not valid', () => {
      const
        errorMessages = [],
        typeOptions = {
          formats: ['epoch_millis']
        };

      momentMock.utc.returns({isValid: () => false});

      should(dateType.validate(typeOptions, '1234567890', errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The date format is not valid.']);
    });

    it('should return true if the date is after the min date', () => {
      const
        typeOptions = {
          formats: ['epoch_millis'],
          range: {min: {}}
        };

      momentMock.utc.returns({isValid: () => true, isBefore: () => false});

      should(dateType.validate(typeOptions, '1234567890', [])).be.true();
    });

    it('should return false if the date is before the min date', () => {
      const
        errorMessages = [],
        typeOptions = {
          formats: ['epoch_millis'],
          range: {min: {}}
        };

      momentMock.utc.returns({isValid: () => true, isBefore: () => true});

      should(dateType.validate(typeOptions, '1234567890', errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The provided date is before the defined minimum.']);
    });

    it('should call moment.utc if min equals the string "NOW"', () => {
      const
        typeOptions = {
          formats: ['epoch_millis'],
          range: {min: 'NOW'}
        };

      momentMock.utc.returns({isValid: () => true, isBefore: () => false});

      should(dateType.validate(typeOptions, '1234567890', [])).be.true();
      should(utcStub.callCount).be.eql(2);
    });

    it('should return true if the date is before the max date', () => {
      const
        typeOptions = {
          formats: ['epoch_millis'],
          range: {
            max: {
              isBefore: sinon.stub().returns(false)
            }
          }
        };

      momentMock.utc.returns({isValid: () => true, isBefore: () => false});

      should(dateType.validate(typeOptions, '1234567890', [])).be.true();
    });

    it('should return false if the date is after the max date', () => {
      const
        errorMessages = [],
        typeOptions = {
          formats: ['epoch_millis'],
          range: {
            max: {
              isBefore: sinon.stub().returns(true)
            }
          }
        };

      momentMock.utc.returns({isValid: () => true, isBefore: () => false});

      should(dateType.validate(typeOptions, '1234567890', errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The provided date is after the defined maximum.']);
    });

    it('should call moment.utc if max equals the string "NOW"', () => {
      const
        typeOptions = {
          formats: ['epoch_millis'],
          range: {
            max: 'NOW'
          }
        };

      momentMock.utc.returns({isValid: () => true, isBefore: () => false});

      should(dateType.validate(typeOptions, '1234567890', [])).be.true();
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return the default typeOptions if typeOptions is empty', () => {
      should(dateType.validateFieldSpecification({})).be.deepEqual({formats: ['epoch_millis']});
    });

    it('should return the provided typeOptions if formats is defined and valid', () => {
      const
        typeOptions = {
          formats: ['basic_ordinal_date', 'strict_basic_week_date_time']
        };

      should(dateType.validateFieldSpecification(typeOptions)).be.deepEqual(typeOptions);
    });

    it('should return false if formats is empty', () => {
      should(dateType.validateFieldSpecification({formats: []})).be.false();
    });

    it('should return false if formats contains an unknown format', () => {
      should(dateType.validateFieldSpecification({formats: ['not_valid']})).be.false();
    });

    it('should return false if range contains an unknown property', () => {
      should(dateType.validateFieldSpecification({range: {unknown: 'property'}})).be.false();
    });

    it('should return typeOpts with min equal to NOW if provided value is NOW', () => {
      const
        typeOptions = {
          range: {min: 'NOW'},
          formats: ['epoch_millis']
        };

      utcStub.returns({
        isValid: isValidStub
      });
      isValidStub.returns(true);

      should(dateType.validateFieldSpecification(typeOptions)).be.deepEqual(typeOptions);
    });

    it('should return typeOpts with max equal to NOW if provided value is NOW', () => {
      const
        typeOptions = {
          range: {max: 'NOW'},
          formats: ['epoch_millis']
        };

      utcStub.returns({
        isValid: isValidStub
      });
      isValidStub.returns(true);

      should(dateType.validateFieldSpecification(typeOptions)).be.deepEqual(typeOptions);
    });

    it('should return false if min is not a string', () => {
      const
        typeOptions = {range: {min: 42}};

      should(dateType.validateFieldSpecification(typeOptions)).be.false();
    });

    it('should return false if max is not a string', () => {
      const
        typeOptions = {range: {max: 42}};

      should(dateType.validateFieldSpecification(typeOptions)).be.false();
    });

    it('should return false if min is not valid', () => {
      const
        typeOptions = {
          range: {min: 'not_valid'},
          formats: ['epoch_millis']
        };

      utcStub.returns({
        isValid: isValidStub
      });
      isValidStub.returns(false);

      should(dateType.validateFieldSpecification(typeOptions)).be.false();
    });

    it('should return false if max is not valid', () => {
      const
        typeOptions = {
          range: {max: 'not_valid'},
          formats: ['epoch_millis']
        };

      utcStub.returns({
        isValid: isValidStub
      });
      isValidStub.returns(false);

      should(dateType.validateFieldSpecification(typeOptions)).be.false();
    });

    it('should return false if max is before min', () => {
      const
        typeOptions = {
          range: {min: '2020-01-01', max: '2010-01-01'},
          formats: ['epoch_millis']
        };

      utcStub.returns({
        isValid: isValidStub,
        isBefore: isBeforeStub
      });
      isValidStub.returns(true);
      isBeforeStub.returns(true);

      should(dateType.validateFieldSpecification(typeOptions)).be.false();
    });

    it('should return modified typeOptions if min and max are defined dates', () => {
      const
        typeOptions = {
          range: {min: '2010-01-01', max: '2020-01-01'},
          formats: ['epoch_millis']
        };

      utcStub.returns({
        isMoment: true,
        isValid: isValidStub,
        isBefore: isBeforeStub
      });
      isValidStub.returns(true);
      isBeforeStub.returns(false);

      const result = dateType.validateFieldSpecification(typeOptions);

      should(typeof result).be.eql('object');
      should(result.range.hasOwnProperty('min')).be.true();
      should(result.range.min.hasOwnProperty('isMoment')).be.true();
      should(result.range.hasOwnProperty('max')).be.true();
      should(result.range.max.hasOwnProperty('isMoment')).be.true();
    });
  });

  describe('#formatMap', () => {
    const
      Rewired = rewire('../../../../../lib/api/core/validation/types/date'),
      formatMap = Rewired.__get__('formatMap'),
      utcDate = '1234567890',
      unixDate = 'unixDate',
      expectedArguments = {
        epoch_millis: [Number.parseInt(utcDate)],
        epoch_second: [unixDate],
        strict_date_optional_time: [utcDate, momentMock.ISO_8601, true],
        basic_date: [utcDate, 'YYYYMMDD', true],
        basic_date_time: [utcDate, 'YYYYMMDD\\THHmmss.SSSZ', true],
        basic_date_time_no_millis: [utcDate, 'YYYYMMDD\\THHmmssZ', true],
        basic_ordinal_date: [utcDate, 'YYYYDDD', true],
        basic_ordinal_date_time: [utcDate, 'YYYYDDD\\THHmmss.SSSZ', true],
        basic_ordinal_date_time_no_millis: [utcDate, 'YYYYDDD\\THHmmssZ', true],
        basic_time: [utcDate, 'HHmmss.SSSZ', true],
        basic_time_no_millis: [utcDate, 'HHmmssZ', true],
        basic_t_time: [utcDate, '\\THHmmss.SSSZ', true],
        basic_t_time_no_millis: [utcDate, '\\THHmmssZ', true],
        basic_week_date: [utcDate, 'gggg\\Wwwe', false],
        strict_basic_week_date: [utcDate, 'gggg\\Wwwe', true],
        basic_week_date_time: [utcDate, 'gggg\\Wwwe\\THHmmss.SSSZ', false],
        strict_basic_week_date_time: [utcDate, 'gggg\\Wwwe\\THHmmss.SSSZ', true],
        basic_week_date_time_no_millis: [utcDate, 'gggg\\Wwwe\\THHmmssZ', false],
        strict_basic_week_date_time_no_millis: [utcDate, 'gggg\\Wwwe\\THHmmssZ', true],
        date: [utcDate, 'YYYY-MM-DD', false],
        strict_date: [utcDate, 'YYYY-MM-DD', true],
        date_hour: [utcDate, 'YYYY-MM-DD\\THH', false],
        strict_date_hour: [utcDate, 'YYYY-MM-DD\\THH', true],
        date_hour_minute: [utcDate, 'YYYY-MM-DD\\THH:mm', false],
        strict_date_hour_minute: [utcDate, 'YYYY-MM-DD\\THH:mm', true],
        date_hour_minute_second: [utcDate, 'YYYY-MM-DD\\THH:mm:ss', false],
        strict_date_hour_minute_second: [utcDate, 'YYYY-MM-DD\\THH:mm:ss', true],
        date_hour_minute_second_fraction: [utcDate, 'YYYY-MM-DD\\THH:mm:ss.SSS', false],
        strict_date_hour_minute_second_fraction: [utcDate, 'YYYY-MM-DD\\THH:mm:ss.SSS', true],
        date_hour_minute_second_millis: [utcDate, 'YYYY-MM-DD\\THH:mm:ss.SSS', false],
        strict_date_hour_minute_second_millis: [utcDate, 'YYYY-MM-DD\\THH:mm:ss.SSS', true],
        date_time: [utcDate, 'YYYY-MM-DD\\THH:mm:ss.SSSZZ', false],
        strict_date_time: [utcDate, 'YYYY-MM-DD\\THH:mm:ss.SSSZZ', true],
        date_time_no_millis: [utcDate, 'YYYY-MM-DD\\THH:mm:ssZZ', false],
        strict_date_time_no_millis: [utcDate, 'YYYY-MM-DD\\THH:mm:ssZZ', true],
        hour: [utcDate, 'HH', false],
        strict_hour: [utcDate, 'HH', true],
        hour_minute: [utcDate, 'HH:mm', false],
        strict_hour_minute: [utcDate, 'HH:mm', true],
        hour_minute_second: [utcDate, 'HH:mm:ss', false],
        strict_hour_minute_second: [utcDate, 'HH:mm:ss', true],
        hour_minute_second_fraction: [utcDate, 'HH:mm:ss.SSS', false],
        strict_hour_minute_second_fraction: [utcDate, 'HH:mm:ss.SSS', true],
        hour_minute_second_millis: [utcDate, 'HH:mm:ss.SSS', false],
        strict_hour_minute_second_millis: [utcDate, 'HH:mm:ss.SSS', true],
        ordinal_date: [utcDate, 'YYYY-DDD', false],
        strict_ordinal_date: [utcDate, 'YYYY-DDD', true],
        ordinal_date_time: [utcDate, 'YYYY-DDD\\THH:mm:ss.SSSZZ', false],
        strict_ordinal_date_time: [utcDate, 'YYYY-DDD\\THH:mm:ss.SSSZZ', true],
        ordinal_date_time_no_millis: [utcDate, 'YYYY-DDD\\THH:mm:ssZZ', false],
        strict_ordinal_date_time_no_millis: [utcDate, 'YYYY-DDD\\THH:mm:ssZZ', true],
        time: [utcDate, 'HH:mm:ss.SSSZZ', false],
        strict_time: [utcDate, 'HH:mm:ss.SSSZZ', true],
        time_no_millis: [utcDate, 'HH:mm:ssZZ', false],
        strict_time_no_millis: [utcDate, 'HH:mm:ssZZ', true],
        t_time: [utcDate, '\\THH:mm:ss.SSSZZ', false],
        strict_t_time: [utcDate, '\\THH:mm:ss.SSSZZ', true],
        t_time_no_millis: [utcDate, '\\THH:mm:ssZZ', false],
        strict_t_time_no_millis: [utcDate, '\\THH:mm:ssZZ', true],
        week_date: [utcDate, 'gggg-\\Www-e', false],
        strict_week_date: [utcDate, 'gggg-\\Www-e', true],
        week_date_time: [utcDate, 'gggg-\\Www-e\\THH:mm:ss.SSSZZ', false],
        strict_week_date_time: [utcDate, 'gggg-\\Www-e\\THH:mm:ss.SSSZZ', true],
        week_date_time_no_millis: [utcDate, 'gggg-\\Www-e\\THH:mm:ssZZ', false],
        strict_week_date_time_no_millis: [utcDate, 'gggg-\\Www-e\\THH:mm:ssZZ', true],
        weekyear: [utcDate, 'gggg', false],
        strict_weekyear: [utcDate, 'gggg', true],
        weekyear_week: [utcDate, 'ggggww', false],
        strict_weekyear_week: [utcDate, 'ggggww', true],
        weekyear_week_day: [utcDate, 'ggggwwe', false],
        strict_weekyear_week_day: [utcDate, 'ggggwwe', true],
        year: [utcDate, 'YYYY', false],
        strict_year: [utcDate, 'YYYY', true],
        year_month: [utcDate, 'YYYYMM', false],
        strict_year_month: [utcDate, 'YYYYMM', true],
        year_month_day: [utcDate, 'YYYYMMDD', false],
        strict_year_month_day: [utcDate, 'YYYYMMDD', true]
      },
      formats = Object.keys(formatMap);

    beforeEach(() => {
      utcStub.returns(utcDate);
      unixStub.returns(unixDate);
      momentMock.utc.returns({isValid: () => true});
    });

    formats.forEach(format => {
      it(`should get proper arguments for format "${format}"`, () => {
        dateType.validate({formats: [format]}, utcDate, []);

        should(momentMock.utc).calledWith(...expectedArguments[format]);
      });
    });
  });
});
