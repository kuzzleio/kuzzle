/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const
  PreconditionError = require('kuzzle-common-objects').errors.PreconditionError,
  BaseType = require('../baseType'),
  moment = require('moment'),
  formatMap = {
    epoch_millis: date => typeof date === 'number' ? moment.utc(date) : moment.invalid(),
    epoch_second: date => typeof date === 'number' ? moment.utc(moment.unix(date)) : moment.invalid(),
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
 * @class DateType
 */
class DateType extends BaseType {
  constructor() {
    super();
    this.typeName = 'date';
    this.allowChildren = false;
    this.allowedTypeOptions = ['range', 'formats'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @return {boolean}
   */
  validate(typeOptions, fieldValue, errorMessages) {
    let momentDate = null;

    if (typeOptions.hasOwnProperty('formats')) {
      for (const formatOpt of typeOptions.formats) {
        momentDate = formatMap[formatOpt](fieldValue);

        if (momentDate.isValid()) {
          break;
        }
      }
    } else {
      momentDate = formatMap.epoch_millis(fieldValue);
    }

    if (!momentDate.isValid()) {
      errorMessages.push('The date format is invalid.');
      return false;
    }

    if (typeOptions.hasOwnProperty('range')) {
      if (typeOptions.range.min) {
        const min = typeOptions.range.min === 'NOW' ? moment.utc() : typeOptions.range.min;

        if (momentDate.isBefore(min)) {
          errorMessages.push('The provided date is before the defined minimum.');
          return false;
        }
      }

      if (typeOptions.range.max) {
        const max = typeOptions.range.max === 'NOW' ? moment.utc() : typeOptions.range.max;

        if (max.isBefore(momentDate)) {
          errorMessages.push('The provided date is after the defined maximum.');
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @return {TypeOptions}
   * @throws {PreconditionError}
   */
  validateFieldSpecification(typeOptions) {
    if (typeOptions.hasOwnProperty('formats')) {
      if (!Array.isArray(typeOptions.formats) || typeOptions.formats.length === 0) {
        throw new PreconditionError('Invalid "formats" option: must be a non-empty array');
      }

      const unrecognized = typeOptions.formats.filter(f => !formatMap[f]);
      if (unrecognized.length > 0) {
        throw new PreconditionError(`Unrecognized format name${unrecognized.length > 1 ? 's' : ''}: ${unrecognized}`);
      }
    } else {
      typeOptions.formats = ['epoch_millis'];
    }

    if (typeOptions.hasOwnProperty('range')) {
      let 
        min = null,
        max = null;

      if (!this.checkAllowedProperties(typeOptions.range, ['min', 'max'])) {
        throw new PreconditionError('Invalid "range" option definition');
      }

      if (typeOptions.range.hasOwnProperty('min')) {
        min = convertRangeValue('min', typeOptions.range.min);
      }

      if (typeOptions.range.hasOwnProperty('max')) {
        max = convertRangeValue('max', typeOptions.range.max);
      }

      if (min && max && max.isBefore(min)) {
        throw new PreconditionError('Invalid range: max > min');
      }

      // We want to keep NOW as a special value, else we would keep the time of the launch
      if (min && typeOptions.range.min !== 'NOW') {
        typeOptions.range.min = min;
      }

      if (max && typeOptions.range.max !== 'NOW') {
        typeOptions.range.max = max;
      }
    }

    return typeOptions;
  }
}

function convertRangeValue(name, value) {
  let converted; 

  if (typeof value === 'string') {
    converted = value === 'NOW' ? moment.utc() : moment.utc(value, moment.ISO_8601);
  } else if (typeof value === 'number') { // epoch or epoch-millis
    converted = moment.utc(value);
  } else {
    throw new PreconditionError(`Option "range.${name}": invalid format`);
  }

  if (!converted.isValid()) {
    throw new PreconditionError(`Unable to parse the range value "${value}"`);
  }

  return converted;
}

module.exports = DateType;
