/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import moment, { Moment, MomentInput } from "moment";

import * as kerror from "../../../kerror";
import { has, isPlainObject } from "../../../util/safeObject";
import BaseType from "../baseType";
import { DateTypeOptions } from "../typeOptions";

type DateParser = (date: MomentInput) => Moment;

const formatMap: Record<string, DateParser> = {
  basic_date: (date) => moment.utc(date, "YYYYMMDD", true),
  basic_date_time: (date) => moment.utc(date, "YYYYMMDD\\THHmmss.SSSZ", true),
  basic_date_time_no_millis: (date) =>
    moment.utc(date, "YYYYMMDD\\THHmmssZ", true),
  basic_ordinal_date: (date) => moment.utc(date, "YYYYDDD", true),
  basic_ordinal_date_time: (date) =>
    moment.utc(date, "YYYYDDD\\THHmmss.SSSZ", true),
  basic_ordinal_date_time_no_millis: (date) =>
    moment.utc(date, "YYYYDDD\\THHmmssZ", true),
  basic_t_time: (date) => moment.utc(date, "\\THHmmss.SSSZ", true),
  basic_t_time_no_millis: (date) => moment.utc(date, "\\THHmmssZ", true),
  basic_time: (date) => moment.utc(date, "HHmmss.SSSZ", true),
  basic_time_no_millis: (date) => moment.utc(date, "HHmmssZ", true),
  basic_week_date: (date) => moment.utc(date, "gggg\\Wwwe", false),
  basic_week_date_time: (date) =>
    moment.utc(date, "gggg\\Wwwe\\THHmmss.SSSZ", false),
  basic_week_date_time_no_millis: (date) =>
    moment.utc(date, "gggg\\Wwwe\\THHmmssZ", false),
  date: (date) => moment.utc(date, "YYYY-MM-DD", false),
  date_hour: (date) => moment.utc(date, "YYYY-MM-DD\\THH", false),
  date_hour_minute: (date) => moment.utc(date, "YYYY-MM-DD\\THH:mm", false),
  date_hour_minute_second: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss", false),
  date_hour_minute_second_fraction: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss.SSS", false),
  date_hour_minute_second_millis: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss.SSS", false),
  date_time: (date) => moment.utc(date, "YYYY-MM-DD\\THH:mm:ss.SSSZZ", false),
  date_time_no_millis: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ssZZ", false),
  epoch_millis: (date) =>
    typeof date === "number" ? moment.utc(date) : moment.invalid(),
  epoch_second: (date) =>
    typeof date === "number" ? moment.utc(moment.unix(date)) : moment.invalid(),
  hour: (date) => moment.utc(date, "HH", false),
  hour_minute: (date) => moment.utc(date, "HH:mm", false),
  hour_minute_second: (date) => moment.utc(date, "HH:mm:ss", false),
  hour_minute_second_fraction: (date) =>
    moment.utc(date, "HH:mm:ss.SSS", false),
  hour_minute_second_millis: (date) => moment.utc(date, "HH:mm:ss.SSS", false),
  ordinal_date: (date) => moment.utc(date, "YYYY-DDD", false),
  ordinal_date_time: (date) =>
    moment.utc(date, "YYYY-DDD\\THH:mm:ss.SSSZZ", false),
  ordinal_date_time_no_millis: (date) =>
    moment.utc(date, "YYYY-DDD\\THH:mm:ssZZ", false),
  strict_basic_week_date: (date) => moment.utc(date, "gggg\\Wwwe", true),
  strict_basic_week_date_time: (date) =>
    moment.utc(date, "gggg\\Wwwe\\THHmmss.SSSZ", true),
  strict_basic_week_date_time_no_millis: (date) =>
    moment.utc(date, "gggg\\Wwwe\\THHmmssZ", true),
  strict_date: (date) => moment.utc(date, "YYYY-MM-DD", true),
  strict_date_hour: (date) => moment.utc(date, "YYYY-MM-DD\\THH", true),
  strict_date_hour_minute: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm", true),
  strict_date_hour_minute_second: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss", true),
  strict_date_hour_minute_second_fraction: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss.SSS", true),
  strict_date_hour_minute_second_millis: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss.SSS", true),
  strict_date_optional_time: (date) => moment.utc(date, moment.ISO_8601, true),
  strict_date_time: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ss.SSSZZ", true),
  strict_date_time_no_millis: (date) =>
    moment.utc(date, "YYYY-MM-DD\\THH:mm:ssZZ", true),
  strict_hour: (date) => moment.utc(date, "HH", true),
  strict_hour_minute: (date) => moment.utc(date, "HH:mm", true),
  strict_hour_minute_second: (date) => moment.utc(date, "HH:mm:ss", true),
  strict_hour_minute_second_fraction: (date) =>
    moment.utc(date, "HH:mm:ss.SSS", true),
  strict_hour_minute_second_millis: (date) =>
    moment.utc(date, "HH:mm:ss.SSS", true),
  strict_ordinal_date: (date) => moment.utc(date, "YYYY-DDD", true),
  strict_ordinal_date_time: (date) =>
    moment.utc(date, "YYYY-DDD\\THH:mm:ss.SSSZZ", true),
  strict_ordinal_date_time_no_millis: (date) =>
    moment.utc(date, "YYYY-DDD\\THH:mm:ssZZ", true),
  strict_t_time: (date) => moment.utc(date, "\\THH:mm:ss.SSSZZ", true),
  strict_t_time_no_millis: (date) => moment.utc(date, "\\THH:mm:ssZZ", true),
  strict_time: (date) => moment.utc(date, "HH:mm:ss.SSSZZ", true),
  strict_time_no_millis: (date) => moment.utc(date, "HH:mm:ssZZ", true),
  strict_week_date: (date) => moment.utc(date, "gggg-\\Www-e", true),
  strict_week_date_time: (date) =>
    moment.utc(date, "gggg-\\Www-e\\THH:mm:ss.SSSZZ", true),
  strict_week_date_time_no_millis: (date) =>
    moment.utc(date, "gggg-\\Www-e\\THH:mm:ssZZ", true),
  strict_weekyear: (date) => moment.utc(date, "gggg", true),
  strict_weekyear_week: (date) => moment.utc(date, "ggggww", true),
  strict_weekyear_week_day: (date) => moment.utc(date, "ggggwwe", true),
  strict_year: (date) => moment.utc(date, "YYYY", true),
  strict_year_month: (date) => moment.utc(date, "YYYYMM", true),
  strict_year_month_day: (date) => moment.utc(date, "YYYYMMDD", true),
  t_time: (date) => moment.utc(date, "\\THH:mm:ss.SSSZZ", false),
  t_time_no_millis: (date) => moment.utc(date, "\\THH:mm:ssZZ", false),
  time: (date) => moment.utc(date, "HH:mm:ss.SSSZZ", false),
  time_no_millis: (date) => moment.utc(date, "HH:mm:ssZZ", false),
  week_date: (date) => moment.utc(date, "gggg-\\Www-e", false),
  week_date_time: (date) =>
    moment.utc(date, "gggg-\\Www-e\\THH:mm:ss.SSSZZ", false),
  week_date_time_no_millis: (date) =>
    moment.utc(date, "gggg-\\Www-e\\THH:mm:ssZZ", false),
  weekyear: (date) => moment.utc(date, "gggg", false),
  weekyear_week: (date) => moment.utc(date, "ggggww", false),
  weekyear_week_day: (date) => moment.utc(date, "ggggwwe", false),
  year: (date) => moment.utc(date, "YYYY", false),
  year_month: (date) => moment.utc(date, "YYYYMM", false),
  year_month_day: (date) => moment.utc(date, "YYYYMMDD", false),
};

const assertionError = kerror.wrap("validation", "assert"),
  typeError = kerror.wrap("validation", "types");

class DateType extends BaseType<DateTypeOptions> {
  public typeName = "date";
  public allowChildren = false;
  public allowedTypeOptions = ["range", "formats"];

  validate(
    typeOptions: DateTypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    let momentDate: Moment | null = null;

    for (const formatOpt of typeOptions.formats ?? []) {
      const parse = formatMap[formatOpt];

      // unreachable: validateFieldSpecification rejects unknown formats
      if (!parse) {
        continue;
      }

      // `moment` is the one telling an unparseable value apart from a date
      momentDate = parse(fieldValue as MomentInput);

      if (momentDate.isValid()) {
        break;
      }
    }

    if (momentDate === null || !momentDate.isValid()) {
      errorMessages.push("The date format is invalid.");
      return false;
    }

    const { range } = typeOptions;

    if (isPlainObject(range)) {
      if (range.min) {
        const min = range.min === "NOW" ? moment.utc() : range.min;

        if (momentDate.isBefore(min)) {
          errorMessages.push(
            "The provided date is before the defined minimum.",
          );
          return false;
        }
      }

      if (range.max) {
        const max = range.max === "NOW" ? moment.utc() : range.max;

        if (max.isBefore(momentDate)) {
          errorMessages.push("The provided date is after the defined maximum.");
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(typeOptions: DateTypeOptions): DateTypeOptions {
    if (has(typeOptions, "formats")) {
      const { formats } = typeOptions;

      if (!Array.isArray(formats) || formats.length === 0) {
        throw assertionError.get("invalid_type", "formats", "non-empty array");
      }

      const unrecognized = formats.filter((f) => !formatMap[f]);

      if (unrecognized.length > 0) {
        throw typeError.get("invalid_date_format", unrecognized.join(", "));
      }
    } else {
      typeOptions.formats = ["epoch_millis"];
    }

    const { range } = typeOptions;

    if (has(typeOptions, "range")) {
      let min: Moment | null = null,
        max: Moment | null = null;

      if (!this.checkAllowedProperties(range, ["min", "max"])) {
        throw assertionError.get("unexpected_properties", "range", "min, max");
      }

      if (has(range, "min")) {
        min = convertRangeValue(range.min);
      }

      if (has(range, "max")) {
        max = convertRangeValue(range.max);
      }

      if (min && max && max.isBefore(min)) {
        throw assertionError.get("invalid_range", "range", "min", "max");
      }

      // We want to keep NOW as a special value, else we would keep the time
      // of the launch
      if (min && range.min !== "NOW") {
        range.min = min;
      }

      if (max && range.max !== "NOW") {
        range.max = max;
      }
    }

    return typeOptions;
  }
}

function convertRangeValue(value: unknown): Moment {
  let converted: Moment | undefined;

  if (typeof value === "string") {
    converted =
      value === "NOW" ? moment.utc() : moment.utc(value, moment.ISO_8601);
  } else if (typeof value === "number") {
    // epoch or epoch-millis
    converted = moment.utc(value);
  }

  if (!converted || !converted.isValid()) {
    throw typeError.get("invalid_date", value);
  }

  return converted;
}

export = DateType;
