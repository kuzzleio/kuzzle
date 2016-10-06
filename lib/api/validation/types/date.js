var
  BaseConstructor = require('../baseType'),
  moment = require('moment'),
  allowedRangeOptions = ['min', 'max'],
  formatMap = {
    epoch_millis: date => moment.utc(Number.parseInt(date)),
    epoch_second: date => moment.utc(moment.unix(Number.parseInt(date))),
    strict_date_optional_time: date => moment.utc(date, moment.ISO_8601, true),
    basic_date: date => moment.utc(date, 'YYYYMMDD', true),
    basic_date_time: date => moment.utc(date, 'YYYYMMDD\\THHmmss.SSSZ', true),
    basic_date_time_no_millis: date => moment.utc(date, 'YYYYMMDD\\THHmmssZ', true),
    basic_ordinal_date: date => moment.utc(date, 'YYYYDDD', true),
    basic_ordinal_date_time: date => moment.utc(date, 'YYYYDDD\\THHmmss.SSSZ', true),
    basic_ordinal_date_time_no_millis: date => moment.utc(date, 'YYYYDDD\\THHmmssZ', true),
    basic_time: date => moment.utc(date, 'HHmmss.SSSZ', true),
    basic_time_no_millis: date => moment.utc(date, 'HHmmssZ', true),
    basic_t_time: date => moment.utc(date, '\\THHmmss.SSSZ', true),
    basic_t_time_no_millis: date => moment.utc(date, '\\THHmmssZ', true),
    basic_week_date: date => moment.utc(date, 'gggg\\Wwwe', false),
    strict_basic_week_date: date => moment.utc(date, 'gggg\\Wwwe', true),
    basic_week_date_time: date => moment.utc(date, 'gggg\\Wwwe\\THHmmss.SSSZ', false),
    strict_basic_week_date_time: date => moment.utc(date, 'gggg\\Wwwe\\THHmmss.SSSZ', true),
    basic_week_date_time_no_millis: date => moment.utc(date, 'gggg\\Wwwe\\THHmmssZ', false),
    strict_basic_week_date_time_no_millis: date => moment.utc(date, 'gggg\\Wwwe\\THHmmssZ', true),
    date: date => moment.utc(date, 'YYYY-MM-DD', false),
    strict_date: date => moment.utc(date, 'YYYY-MM-DD', true),
    date_hour: date => moment.utc(date, 'YYYY-MM-DD\\THH', false),
    strict_date_hour: date => moment.utc(date, 'YYYY-MM-DD\\THH', true),
    date_hour_minute: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm', false),
    strict_date_hour_minute: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm', true),
    date_hour_minute_second: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss', false),
    strict_date_hour_minute_second: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss', true),
    date_hour_minute_second_fraction: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss.SSS', false),
    strict_date_hour_minute_second_fraction: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss.SSS', true),
    date_hour_minute_second_millis: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss.SSS', false),
    strict_date_hour_minute_second_millis: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss.SSS', true),
    date_time: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss.SSSZZ', false),
    strict_date_time: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ss.SSSZZ', true),
    date_time_no_millis: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ssZZ', false),
    strict_date_time_no_millis: date => moment.utc(date, 'YYYY-MM-DD\\THH:mm:ssZZ', true),
    hour: date => moment.utc(date, 'HH', false),
    strict_hour: date => moment.utc(date, 'HH', true),
    hour_minute: date => moment.utc(date, 'HH:mm', false),
    strict_hour_minute: date => moment.utc(date, 'HH:mm', true),
    hour_minute_second: date => moment.utc(date, 'HH:mm:ss', false),
    strict_hour_minute_second: date => moment.utc(date, 'HH:mm:ss', true),
    hour_minute_second_fraction: date => moment.utc(date, 'HH:mm:ss.SSS', false),
    strict_hour_minute_second_fraction: date => moment.utc(date, 'HH:mm:ss.SSS', true),
    hour_minute_second_millis: date => moment.utc(date, 'HH:mm:ss.SSS', false),
    strict_hour_minute_second_millis: date => moment.utc(date, 'HH:mm:ss.SSS', true),
    ordinal_date: date => moment.utc(date, 'YYYY-DDD', false),
    strict_ordinal_date: date => moment.utc(date, 'YYYY-DDD', true),
    ordinal_date_time: date => moment.utc(date, 'YYYY-DDD\\THH:mm:ss.SSSZZ', false),
    strict_ordinal_date_time: date => moment.utc(date, 'YYYY-DDD\\THH:mm:ss.SSSZZ', true),
    ordinal_date_time_no_millis: date => moment.utc(date, 'YYYY-DDD\\THH:mm:ssZZ', false),
    strict_ordinal_date_time_no_millis: date => moment.utc(date, 'YYYY-DDD\\THH:mm:ssZZ', true),
    time: date => moment.utc(date, 'HH:mm:ss.SSSZZ', false),
    strict_time: date => moment.utc(date, 'HH:mm:ss.SSSZZ', true),
    time_no_millis: date => moment.utc(date, 'HH:mm:ssZZ', false),
    strict_time_no_millis: date => moment.utc(date, 'HH:mm:ssZZ', true),
    t_time: date => moment.utc(date, '\\THH:mm:ss.SSSZZ', false),
    strict_t_time: date => moment.utc(date, '\\THH:mm:ss.SSSZZ', true),
    t_time_no_millis: date => moment.utc(date, '\\THH:mm:ssZZ', false),
    strict_t_time_no_millis: date => moment.utc(date, '\\THH:mm:ssZZ', true),
    week_date: date => moment.utc(date, 'gggg-\\Www-e', false),
    strict_week_date: date => moment.utc(date, 'gggg-\\Www-e', true),
    week_date_time: date => moment.utc(date, 'gggg-\\Www-e\\THH:mm:ss.SSSZZ', false),
    strict_week_date_time: date => moment.utc(date, 'gggg-\\Www-e\\THH:mm:ss.SSSZZ', true),
    week_date_time_no_millis: date => moment.utc(date, 'gggg-\\Www-e\\THH:mm:ssZZ', false),
    strict_week_date_time_no_millis: date => moment.utc(date, 'gggg-\\Www-e\\THH:mm:ssZZ', true),
    weekyear: date => moment.utc(date, 'gggg', false),
    strict_weekyear: date => moment.utc(date, 'gggg', true),
    weekyear_week: date => moment.utc(date, 'ggggww', false),
    strict_weekyear_week: date => moment.utc(date, 'ggggww', true),
    weekyear_week_day: date => moment.utc(date, 'ggggwwe', false),
    strict_weekyear_week_day: date => moment.utc(date, 'ggggwwe', true),
    year: date => moment.utc(date, 'YYYY', false),
    strict_year: date => moment.utc(date, 'YYYY', true),
    year_month: date => moment.utc(date, 'YYYYMM', false),
    strict_year_month: date => moment.utc(date, 'YYYYMM', true),
    year_month_day: date => moment.utc(date, 'YYYYMMDD', false),
    strict_year_month_day: date => moment.utc(date, 'YYYYMMDD', true)
  };

/**
 * @constructor
 */
function DateType () {
  this.typeName = 'date';
  this.allowChildren = false;
  this.allowedTypeOptions = ['range', 'format'];
}

DateType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
DateType.prototype.validate = function (typeOptions, fieldValue) {
  var
    i,
    momentDate,
    valid = false;

  for (i = 0; i < typeOptions.format.length; i++) {
    momentDate = formatMap[typeOptions.format[i]](fieldValue);
    if (momentDate.isValid()) {
      valid = true;
      break;
    }
  }

  if (!valid) {
    return false;
  }

  if (typeOptions.hasOwnProperty('range')) {
    if (typeOptions.range.min && momentDate.isBefore(typeOptions.range.min)) {
      return false;
    }

    if (typeOptions.range.max && typeOptions.range.max.isBefore(momentDate)) {
      return false;
    }
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
DateType.prototype.validateFieldSpecification = function (typeOptions) {
  var
    result = true,
    min,
    max;

  if (typeOptions.hasOwnProperty('format')) {
    if (!Array.isArray(typeOptions.format) || typeOptions.format.length === 0) {
      return false;
    }

    typeOptions.format.forEach(format => {
      if (Object.keys(formatMap).indexOf(format) === -1) {
        result = false;
        return false;
      }
    });

    if (!result) {
      return false;
    }
  }
  else {
    typeOptions.format = ['epoch_millis'];
  }

  if (typeOptions.hasOwnProperty('range')) {
    if (!this.checkAllowedProperties(typeOptions.range, allowedRangeOptions)) {
      return false;
    }

    if (typeOptions.range.hasOwnProperty('min')) {
      if (typeof typeOptions.range.min !== 'string') {
        return false;
      }

      min = (typeOptions.range.min === 'NOW') ? moment.utc() : moment.utc(typeOptions.range.min, moment.ISO_8601);

      if (!min.isValid()) {
        return false;
      }
    }

    if (typeOptions.range.hasOwnProperty('max')) {
      if (typeof typeOptions.range.max !== 'string') {
        return false;
      }

      max = (typeOptions.range.max === 'NOW') ? moment.utc() : moment.utc(typeOptions.range.max, moment.ISO_8601);

      if (!max.isValid()) {
        return false;
      }
    }

    if (min && max && max.isBefore(min)) {
      return false;
    }

    if (min) {
      typeOptions.range.min = min;
    }

    if (max) {
      typeOptions.range.max = max;
    }
  }

  return typeOptions;
};

module.exports = DateType;