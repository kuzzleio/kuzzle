"use strict";

const sinon = require("sinon");
const should = require("should");
const mockrequire = require("mock-require");

const { PreconditionError } = require("../../../../index");
const BaseType = require("../../../../lib/core/validation/baseType");
const DateType = require("../../../../lib/core/validation/types/date");

describe("Test: validation/types/date", () => {
  let dateType;

  beforeEach(() => {
    dateType = new DateType();
  });

  it("should inherit the BaseType class", () => {
    should(dateType).be.instanceOf(BaseType);
  });

  it("should construct properly", () => {
    should(typeof dateType.typeName).be.eql("string");
    should(typeof dateType.allowChildren).be.eql("boolean");
    should(Array.isArray(dateType.allowedTypeOptions)).be.true();
    should(dateType.typeName).be.eql("date");
    should(dateType.allowChildren).be.false();
  });

  describe("#validateFieldSpecification", () => {
    it("should return a default options structure if the provided options are empty", () => {
      should(dateType.validateFieldSpecification({})).be.deepEqual({
        formats: ["epoch_millis"],
      });
    });

    it("should return the provided typeOptions if formats is defined and valid", () => {
      const typeOptions = {
        formats: ["basic_ordinal_date", "strict_basic_week_date_time"],
      };

      should(dateType.validateFieldSpecification(typeOptions)).be.deepEqual(
        typeOptions
      );
    });

    it('should throw if an invalid "formats" options is provided', () => {
      should(() => dateType.validateFieldSpecification({ formats: [] })).throw(
        PreconditionError,
        { id: "validation.assert.invalid_type" }
      );

      should(() =>
        dateType.validateFieldSpecification({ formats: null })
      ).throw(PreconditionError, { id: "validation.assert.invalid_type" });
    });

    it('should throw if the "formats" option contains an unknown format', () => {
      should(() =>
        dateType.validateFieldSpecification({ formats: ["foobar"] })
      ).throw(PreconditionError, {
        id: "validation.types.invalid_date_format",
        message: "The following date types are invalid: foobar.",
      });

      should(() =>
        dateType.validateFieldSpecification({
          formats: ["foo", "epoch_millis", "bar"],
        })
      ).throw(PreconditionError, {
        id: "validation.types.invalid_date_format",
        message: "The following date types are invalid: foo, bar.",
      });
    });

    it('should throw if the "range" option is invalid', () => {
      should(() => dateType.validateFieldSpecification({ range: null })).throw(
        PreconditionError,
        {
          id: "validation.assert.unexpected_properties",
          message:
            'The object "range" contains unexpected properties (allowed: min, max).',
        }
      );

      should(() => dateType.validateFieldSpecification({ range: [] })).throw(
        PreconditionError,
        {
          id: "validation.assert.unexpected_properties",
          message:
            'The object "range" contains unexpected properties (allowed: min, max).',
        }
      );

      should(() =>
        dateType.validateFieldSpecification({ range: { unknown: null } })
      ).throw(PreconditionError, {
        id: "validation.assert.unexpected_properties",
        message:
          'The object "range" contains unexpected properties (allowed: min, max).',
      });
    });

    it('should leave the "min" option intact if it contains the special value "NOW"', () => {
      const typeOptions = { range: { min: "NOW" } };

      should(dateType.validateFieldSpecification(typeOptions)).be.deepEqual(
        typeOptions
      );
    });

    it('should leave the "max" option intact if it contains the special value "NOW"', () => {
      const typeOptions = { range: { max: "NOW" } };

      should(dateType.validateFieldSpecification(typeOptions)).be.deepEqual(
        typeOptions
      );
    });

    it('should throw if "min" is not a valid date', () => {
      should(() =>
        dateType.validateFieldSpecification({ range: { min: "foobar" } })
      ).throw(PreconditionError, { id: "validation.types.invalid_date" });

      should(() =>
        dateType.validateFieldSpecification({ range: { min: null } })
      ).throw(PreconditionError, { id: "validation.types.invalid_date" });
    });

    it('should throw if "max" is not a valid date', () => {
      should(() =>
        dateType.validateFieldSpecification({ range: { max: "foobar" } })
      ).throw(PreconditionError, { id: "validation.types.invalid_date" });

      should(() =>
        dateType.validateFieldSpecification({ range: { max: null } })
      ).throw(PreconditionError, { id: "validation.types.invalid_date" });
    });

    it("should throw if max < min", () => {
      const typeOptions = {
        range: { min: "2020-01-01", max: "2010-01-01" },
        formats: ["epoch_millis"],
      };

      should(() => dateType.validateFieldSpecification(typeOptions)).throw(
        PreconditionError,
        { id: "validation.assert.invalid_range" }
      );
    });

    it("should convert min and max to moment objects if they are valid", () => {
      const typeOptions = {
        range: { min: "2010-01-01", max: "2020-01-01" },
        formats: ["epoch_millis"],
      };

      const result = dateType.validateFieldSpecification(typeOptions);

      should(typeof result).be.eql("object");
      should(result.range.min._isAMomentObject).be.true();
      should(result.range.min.isValid()).be.true();
      should(result.range.max._isAMomentObject).be.true();
      should(result.range.max.isValid()).be.true();
    });
  });

  describe("#validate", () => {
    it("should return true if the date format is valid", () => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
      });

      should(dateType.validate(typeOptions, Date.now(), [])).be.true();
    });

    it("should return false if the date format is not valid", () => {
      const errorMessages = [],
        typeOptions = dateType.validateFieldSpecification({
          formats: ["epoch_millis"],
        });

      should(
        dateType.validate(typeOptions, "foobar", errorMessages)
      ).be.false();
      should(errorMessages).be.deepEqual(["The date format is invalid."]);
    });

    it("should validate if the date is after the min date", () => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis", "strict_date"],
        range: { min: "2013-09-21" },
      });

      should(dateType.validate(typeOptions, "2014-01-01", [])).be.true();
    });

    it("should not validate if the date is before the min date", () => {
      const errorMessages = [],
        typeOptions = dateType.validateFieldSpecification({
          formats: ["epoch_millis"],
          range: { min: Date.now() },
        });

      should(
        dateType.validate(typeOptions, Date.now() - 10000, errorMessages)
      ).be.false();
      should(errorMessages).be.deepEqual([
        "The provided date is before the defined minimum.",
      ]);
    });

    it('should call moment.utc if min equals the string "NOW"', (done) => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
        range: { min: "NOW" },
      });

      should(dateType.validate(typeOptions, Date.now() + 10, [])).be.true();
      should(dateType.validate(typeOptions, Date.now() - 10, [])).be.false();

      setTimeout(() => {
        try {
          should(dateType.validate(typeOptions, Date.now() + 10, [])).be.true();
          should(
            dateType.validate(typeOptions, Date.now() - 10, [])
          ).be.false();
          done();
        } catch (e) {
          done(e);
        }
      }, 100);
    });

    it("should validate if the date is before the max date", () => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["strict_basic_week_date", "epoch_millis", "strict_date"],
        range: {
          max: Date.now() + 1000,
        },
      });

      should(dateType.validate(typeOptions, Date.now(), [])).be.true();
    });

    it("should not validate if the date is after the max date", () => {
      const errorMessages = [],
        typeOptions = dateType.validateFieldSpecification({
          formats: ["epoch_millis"],
          range: {
            max: Date.now(),
          },
        });

      should(
        dateType.validate(typeOptions, Date.now() + 1000, errorMessages)
      ).be.false();
      should(errorMessages).be.deepEqual([
        "The provided date is after the defined maximum.",
      ]);
    });

    it('should call moment.utc if max equals the string "NOW"', (done) => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
        range: { max: "NOW" },
      });

      should(dateType.validate(typeOptions, Date.now() + 10, [])).be.false();
      should(dateType.validate(typeOptions, Date.now() - 10, [])).be.true();

      setTimeout(() => {
        try {
          should(
            dateType.validate(typeOptions, Date.now() + 10, [])
          ).be.false();
          should(dateType.validate(typeOptions, Date.now() - 10, [])).be.true();
          done();
        } catch (e) {
          done(e);
        }
      }, 100);
    });
  });

  describe("#formatMap", () => {
    let DateWithMockedMoment;
    const utcDate = "1234567890",
      momentMock = {
        ISO_8601: "ISO_8601_MOCK",
        utc: sinon.stub().returns({ isValid: () => true }),
        invalid: sinon.stub().returns({ isValid: () => true }),
        unix: sinon.stub().returnsArg(0),
      },
      expectedArguments = {
        strict_date_optional_time: [utcDate, momentMock.ISO_8601, true],
        basic_date: [utcDate, "YYYYMMDD", true],
        basic_date_time: [utcDate, "YYYYMMDD\\THHmmss.SSSZ", true],
        basic_date_time_no_millis: [utcDate, "YYYYMMDD\\THHmmssZ", true],
        basic_ordinal_date: [utcDate, "YYYYDDD", true],
        basic_ordinal_date_time: [utcDate, "YYYYDDD\\THHmmss.SSSZ", true],
        basic_ordinal_date_time_no_millis: [utcDate, "YYYYDDD\\THHmmssZ", true],
        basic_time: [utcDate, "HHmmss.SSSZ", true],
        basic_time_no_millis: [utcDate, "HHmmssZ", true],
        basic_t_time: [utcDate, "\\THHmmss.SSSZ", true],
        basic_t_time_no_millis: [utcDate, "\\THHmmssZ", true],
        basic_week_date: [utcDate, "gggg\\Wwwe", false],
        strict_basic_week_date: [utcDate, "gggg\\Wwwe", true],
        basic_week_date_time: [utcDate, "gggg\\Wwwe\\THHmmss.SSSZ", false],
        strict_basic_week_date_time: [
          utcDate,
          "gggg\\Wwwe\\THHmmss.SSSZ",
          true,
        ],
        basic_week_date_time_no_millis: [
          utcDate,
          "gggg\\Wwwe\\THHmmssZ",
          false,
        ],
        strict_basic_week_date_time_no_millis: [
          utcDate,
          "gggg\\Wwwe\\THHmmssZ",
          true,
        ],
        date: [utcDate, "YYYY-MM-DD", false],
        strict_date: [utcDate, "YYYY-MM-DD", true],
        date_hour: [utcDate, "YYYY-MM-DD\\THH", false],
        strict_date_hour: [utcDate, "YYYY-MM-DD\\THH", true],
        date_hour_minute: [utcDate, "YYYY-MM-DD\\THH:mm", false],
        strict_date_hour_minute: [utcDate, "YYYY-MM-DD\\THH:mm", true],
        date_hour_minute_second: [utcDate, "YYYY-MM-DD\\THH:mm:ss", false],
        strict_date_hour_minute_second: [
          utcDate,
          "YYYY-MM-DD\\THH:mm:ss",
          true,
        ],
        date_hour_minute_second_fraction: [
          utcDate,
          "YYYY-MM-DD\\THH:mm:ss.SSS",
          false,
        ],
        strict_date_hour_minute_second_fraction: [
          utcDate,
          "YYYY-MM-DD\\THH:mm:ss.SSS",
          true,
        ],
        date_hour_minute_second_millis: [
          utcDate,
          "YYYY-MM-DD\\THH:mm:ss.SSS",
          false,
        ],
        strict_date_hour_minute_second_millis: [
          utcDate,
          "YYYY-MM-DD\\THH:mm:ss.SSS",
          true,
        ],
        date_time: [utcDate, "YYYY-MM-DD\\THH:mm:ss.SSSZZ", false],
        strict_date_time: [utcDate, "YYYY-MM-DD\\THH:mm:ss.SSSZZ", true],
        date_time_no_millis: [utcDate, "YYYY-MM-DD\\THH:mm:ssZZ", false],
        strict_date_time_no_millis: [utcDate, "YYYY-MM-DD\\THH:mm:ssZZ", true],
        hour: [utcDate, "HH", false],
        strict_hour: [utcDate, "HH", true],
        hour_minute: [utcDate, "HH:mm", false],
        strict_hour_minute: [utcDate, "HH:mm", true],
        hour_minute_second: [utcDate, "HH:mm:ss", false],
        strict_hour_minute_second: [utcDate, "HH:mm:ss", true],
        hour_minute_second_fraction: [utcDate, "HH:mm:ss.SSS", false],
        strict_hour_minute_second_fraction: [utcDate, "HH:mm:ss.SSS", true],
        hour_minute_second_millis: [utcDate, "HH:mm:ss.SSS", false],
        strict_hour_minute_second_millis: [utcDate, "HH:mm:ss.SSS", true],
        ordinal_date: [utcDate, "YYYY-DDD", false],
        strict_ordinal_date: [utcDate, "YYYY-DDD", true],
        ordinal_date_time: [utcDate, "YYYY-DDD\\THH:mm:ss.SSSZZ", false],
        strict_ordinal_date_time: [utcDate, "YYYY-DDD\\THH:mm:ss.SSSZZ", true],
        ordinal_date_time_no_millis: [utcDate, "YYYY-DDD\\THH:mm:ssZZ", false],
        strict_ordinal_date_time_no_millis: [
          utcDate,
          "YYYY-DDD\\THH:mm:ssZZ",
          true,
        ],
        time: [utcDate, "HH:mm:ss.SSSZZ", false],
        strict_time: [utcDate, "HH:mm:ss.SSSZZ", true],
        time_no_millis: [utcDate, "HH:mm:ssZZ", false],
        strict_time_no_millis: [utcDate, "HH:mm:ssZZ", true],
        t_time: [utcDate, "\\THH:mm:ss.SSSZZ", false],
        strict_t_time: [utcDate, "\\THH:mm:ss.SSSZZ", true],
        t_time_no_millis: [utcDate, "\\THH:mm:ssZZ", false],
        strict_t_time_no_millis: [utcDate, "\\THH:mm:ssZZ", true],
        week_date: [utcDate, "gggg-\\Www-e", false],
        strict_week_date: [utcDate, "gggg-\\Www-e", true],
        week_date_time: [utcDate, "gggg-\\Www-e\\THH:mm:ss.SSSZZ", false],
        strict_week_date_time: [utcDate, "gggg-\\Www-e\\THH:mm:ss.SSSZZ", true],
        week_date_time_no_millis: [utcDate, "gggg-\\Www-e\\THH:mm:ssZZ", false],
        strict_week_date_time_no_millis: [
          utcDate,
          "gggg-\\Www-e\\THH:mm:ssZZ",
          true,
        ],
        weekyear: [utcDate, "gggg", false],
        strict_weekyear: [utcDate, "gggg", true],
        weekyear_week: [utcDate, "ggggww", false],
        strict_weekyear_week: [utcDate, "ggggww", true],
        weekyear_week_day: [utcDate, "ggggwwe", false],
        strict_weekyear_week_day: [utcDate, "ggggwwe", true],
        year: [utcDate, "YYYY", false],
        strict_year: [utcDate, "YYYY", true],
        year_month: [utcDate, "YYYYMM", false],
        strict_year_month: [utcDate, "YYYYMM", true],
        year_month_day: [utcDate, "YYYYMMDD", false],
        strict_year_month_day: [utcDate, "YYYYMMDD", true],
      };

    before(() => {
      mockrequire("moment", momentMock);
      DateWithMockedMoment = mockrequire.reRequire(
        "../../../../lib/core/validation/types/date"
      );
    });

    beforeEach(() => {
      momentMock.utc.returns({ isValid: () => true });
      momentMock.invalid.returns({ isValid: () => true });
      momentMock.unix.returnsArg(0);

      momentMock.utc.resetHistory();
      momentMock.invalid.resetHistory();
      momentMock.unix.resetHistory();
      dateType = new DateWithMockedMoment();
    });

    after(() => {
      mockrequire.stopAll();
    });

    // epoch_second and epoch_millis accept numbers instead of strings for dates,
    // so they behave a bit differently and we need specific tests
    // for these two
    ["epoch_second", "epoch_millis"].forEach((format) => {
      const now = format === "epoch_second" ? Date.now() / 1000 : Date.now();

      it(`should get proper arguments for format "${format}"`, () => {
        const errors = [];

        dateType.validate({ formats: [format] }, now, errors);

        should(errors).be.an.Array().and.be.empty();
        should(momentMock.unix.callCount).be.eql(
          format === "epoch_second" ? 1 : 0
        );
        should(momentMock.utc).calledWith(now);

        // should call moment.invalid() if a non-number date is provided
        momentMock.utc.resetHistory();
        momentMock.invalid.resetHistory();
        momentMock.unix.resetHistory();
        dateType.validate({ formats: [format] }, String(now), errors);

        should(momentMock.utc).not.be.called();
        should(momentMock.unix).not.be.called();
        should(momentMock.invalid).be.calledOnce();
      });
    });

    Object.keys(expectedArguments).forEach((format) => {
      it(`should get proper arguments for format "${format}"`, () => {
        const errors = [];

        dateType.validate({ formats: [format] }, utcDate, errors);

        should(errors).be.an.Array().and.be.empty();
        should(momentMock.utc).calledWith(...expectedArguments[format]);
        should(momentMock.invalid).not.be.called();
      });
    });
  });
});
