import type { Moment } from "moment";
import moment from "moment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BaseType from "../../../../lib/core/validation/baseType";
import type { DateSpecification } from "../../../../lib/core/validation/typeOptions";
import DateType from "../../../../lib/core/validation/types/date";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import { invalid } from "../../../helpers/invalid";

/**
 * The three `moment` entry points the subject reaches for, as spies that
 * **delegate to the real `moment`** until a block says otherwise.
 *
 * ⚠️ This is the conditional substitution [L4](../../../../docs/adr-001/steps/13-sprint-10-test-closure.md)
 * was carved out for, and porting it showed it never needed to be one. The
 * Mocha spec ran its first three blocks against the real `moment`, then, for
 * `#formatMap` alone, registered a total stub and re-required the subject
 * against it — because `mock-require` can only swap a module wholesale, so
 * "spy on three functions" had to be expressed as "replace the module, then
 * reload everything that imports it".
 *
 * `vi.mock` is hoisted and static, so that shape does not port. It does not
 * need to: what `#formatMap` actually asserts is *which arguments each format
 * hands `moment.utc`*, and a spy over the real function answers that without
 * replacing anything. The one thing it does need is a **return** it controls —
 * `1234567890` parses as a valid date under almost none of the 80 formats, and
 * the assertion is that no error was recorded — so `#formatMap` pins the
 * return value in its own `beforeEach` and `passThrough()` puts the real
 * implementation back after it.
 *
 * Same finding as [L4b1](../../../../docs/adr-001/steps/13-sprint-10-test-closure.md)'s
 * two `pino`s, from the other direction: there the two registrations turned
 * out to be one stub, here the one registration turns out not to be a stub at
 * all.
 */
const momentStub = vi.hoisted(() => {
  const spies = {
    invalid: vi.fn(),
    unix: vi.fn(),
    utc: vi.fn(),
  };

  type Spied = keyof typeof spies;

  const real = new Map<Spied, (...args: unknown[]) => unknown>();

  return {
    isSpied: (name: string): name is Spied => name in spies,
    /** Puts the real `moment` back behind the three spies. */
    passThrough() {
      for (const [name, implementation] of real) {
        spies[name].mockImplementation(implementation);
      }
    },
    real,
    spies,
  };
});

vi.mock("moment", async (importOriginal) => {
  const imported = await importOriginal<{ default?: unknown }>();
  const actual = (imported.default ?? imported) as Record<string, unknown>;

  for (const name of ["invalid", "unix", "utc"] as const) {
    momentStub.real.set(name, actual[name] as (...args: unknown[]) => unknown);
  }

  momentStub.passThrough();

  /**
   * A proxy rather than a copy: `moment` carries far more than the subject
   * uses (`ISO_8601`, the locale machinery, the `Moment` prototype the
   * returned objects are built from), and a spread would flatten exactly the
   * parts that are not plain data.
   */
  return {
    default: new Proxy(actual, {
      get: (target, property, receiver) =>
        typeof property === "string" && momentStub.isSpied(property)
          ? momentStub.spies[property]
          : Reflect.get(target, property, receiver),
    }),
  };
});

describe("#core/validation/types/date", () => {
  const dateType = new DateType();

  it("inherits the BaseType class", () => {
    expect(dateType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof dateType.typeName).toEqual("string");
    expect(typeof dateType.allowChildren).toEqual("boolean");
    expect(Array.isArray(dateType.allowedTypeOptions)).toBe(true);
    expect(dateType.typeName).toEqual("date");
    expect(dateType.allowChildren).toBe(false);
  });

  describe("#validateFieldSpecification", () => {
    it("returns a default options structure if the provided options are empty", () => {
      expect(dateType.validateFieldSpecification({})).toEqual({
        formats: ["epoch_millis"],
      });
    });

    it("returns the provided typeOptions if formats is defined and valid", () => {
      const typeOptions = {
        formats: ["basic_ordinal_date", "strict_basic_week_date_time"],
      };

      expect(dateType.validateFieldSpecification(typeOptions)).toEqual(
        typeOptions,
      );
    });

    it('throws if an invalid "formats" option is provided', () => {
      for (const formats of [[], null]) {
        expect(() =>
          dateType.validateFieldSpecification(
            invalid<DateSpecification>({ formats }),
          ),
        ).toThrow(
          expect.objectContaining({
            constructor: PreconditionError,
            id: "validation.assert.invalid_type",
          }),
        );
      }
    });

    it('throws if the "formats" option contains an unknown format', () => {
      expect(() =>
        dateType.validateFieldSpecification({ formats: ["foobar"] }),
      ).toThrow(
        expect.objectContaining({
          constructor: PreconditionError,
          id: "validation.types.invalid_date_format",
          message: "The following date types are invalid: foobar.",
        }),
      );

      expect(() =>
        dateType.validateFieldSpecification({
          formats: ["foo", "epoch_millis", "bar"],
        }),
      ).toThrow(
        expect.objectContaining({
          id: "validation.types.invalid_date_format",
          message: "The following date types are invalid: foo, bar.",
        }),
      );
    });

    it('throws if the "range" option is invalid', () => {
      for (const range of [null, [], { unknown: null }]) {
        expect(() =>
          dateType.validateFieldSpecification(
            invalid<DateSpecification>({ range }),
          ),
        ).toThrow(
          expect.objectContaining({
            constructor: PreconditionError,
            id: "validation.assert.unexpected_properties",
            message:
              'The object "range" contains unexpected properties (allowed: min, max).',
          }),
        );
      }
    });

    it('leaves "min" intact if it contains the special value "NOW"', () => {
      const typeOptions = { range: { min: "NOW" as const } };

      expect(dateType.validateFieldSpecification(typeOptions)).toEqual(
        typeOptions,
      );
    });

    it('leaves "max" intact if it contains the special value "NOW"', () => {
      const typeOptions = { range: { max: "NOW" as const } };

      expect(dateType.validateFieldSpecification(typeOptions)).toEqual(
        typeOptions,
      );
    });

    it('throws if "min" is not a valid date', () => {
      for (const min of ["foobar", null]) {
        expect(() =>
          dateType.validateFieldSpecification(
            invalid<DateSpecification>({ range: { min } }),
          ),
        ).toThrow(
          expect.objectContaining({
            constructor: PreconditionError,
            id: "validation.types.invalid_date",
          }),
        );
      }
    });

    it('throws if "max" is not a valid date', () => {
      for (const max of ["foobar", null]) {
        expect(() =>
          dateType.validateFieldSpecification(
            invalid<DateSpecification>({ range: { max } }),
          ),
        ).toThrow(
          expect.objectContaining({
            constructor: PreconditionError,
            id: "validation.types.invalid_date",
          }),
        );
      }
    });

    it("throws if max < min", () => {
      expect(() =>
        dateType.validateFieldSpecification({
          formats: ["epoch_millis"],
          range: { max: "2010-01-01", min: "2020-01-01" },
        }),
      ).toThrow(
        expect.objectContaining({
          constructor: PreconditionError,
          id: "validation.assert.invalid_range",
        }),
      );
    });

    it("converts min and max to moment objects if they are valid", () => {
      const result = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
        range: { max: "2020-01-01", min: "2010-01-01" },
      });

      const { max, min } = result.range as { max: Moment; min: Moment };

      expect(min.isValid()).toBe(true);
      expect(max.isValid()).toBe(true);
      expect(min.isBefore(max)).toBe(true);
    });

    /**
     * The caller keeps the object it passed: `Validation` stores the result,
     * but the raw specification it read it from is the same object, so the
     * normalisation must stay in place.
     */
    it("normalises the specification in place, range included", () => {
      const specification: DateSpecification = {
        range: { max: "NOW", min: 1262304000000 },
      };
      const { range } = specification;

      const result = dateType.validateFieldSpecification(specification);

      expect(result).toBe(specification);
      expect(result.range).toBe(range);
      expect(result.formats).toEqual(["epoch_millis"]);
      expect(result.range).toEqual({ max: "NOW", min: expect.any(Object) });
      expect(moment.isMoment(result.range?.min)).toBe(true);
    });
  });

  describe("#validate", () => {
    it("returns true if the date format is valid", () => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
      });

      expect(dateType.validate(typeOptions, Date.now(), [])).toBe(true);
    });

    it("returns false if the date format is not valid", () => {
      const errorMessages: string[] = [];
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
      });

      expect(dateType.validate(typeOptions, "foobar", errorMessages)).toBe(
        false,
      );
      expect(errorMessages).toEqual(["The date format is invalid."]);
    });

    it("validates if the date is after the min date", () => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis", "strict_date"],
        range: { min: "2013-09-21" },
      });

      expect(dateType.validate(typeOptions, "2014-01-01", [])).toBe(true);
    });

    it("does not validate if the date is before the min date", () => {
      const errorMessages: string[] = [];
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
        range: { min: Date.now() },
      });

      expect(
        dateType.validate(typeOptions, Date.now() - 10000, errorMessages),
      ).toBe(false);
      expect(errorMessages).toEqual([
        "The provided date is before the defined minimum.",
      ]);
    });

    it("validates if the date is before the max date", () => {
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["strict_basic_week_date", "epoch_millis", "strict_date"],
        range: { max: Date.now() + 1000 },
      });

      expect(dateType.validate(typeOptions, Date.now(), [])).toBe(true);
    });

    it("does not validate if the date is after the max date", () => {
      const errorMessages: string[] = [];
      const typeOptions = dateType.validateFieldSpecification({
        formats: ["epoch_millis"],
        range: { max: Date.now() },
      });

      expect(
        dateType.validate(typeOptions, Date.now() + 1000, errorMessages),
      ).toBe(false);
      expect(errorMessages).toEqual([
        "The provided date is after the defined maximum.",
      ]);
    });

    /**
     * `NOW` is the one bound `validateFieldSpecification` leaves as a string,
     * so that it resolves per call rather than per specification. The wait is
     * what makes that observable: the same `typeOptions`, validated again
     * later, must answer against the *new* now and not the one that was
     * current when the specification was built.
     */
    for (const bound of ["min", "max"] as const) {
      it(`resolves "${bound}: NOW" at validation time, not at specification time`, async () => {
        const typeOptions = dateType.validateFieldSpecification({
          formats: ["epoch_millis"],
          range: { [bound]: "NOW" },
        });

        const [future, past] = bound === "min" ? [true, false] : [false, true];

        expect(dateType.validate(typeOptions, Date.now() + 10, [])).toBe(
          future,
        );
        expect(dateType.validate(typeOptions, Date.now() - 10, [])).toBe(past);

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(dateType.validate(typeOptions, Date.now() + 10, [])).toBe(
          future,
        );
        expect(dateType.validate(typeOptions, Date.now() - 10, [])).toBe(past);
      });
    }
  });

  describe("#formatMap", () => {
    const utcDate = "1234567890";

    /**
     * Every format and the `moment.utc` call it is expected to make. The
     * string/boolean pair is moment's `(input, format, strict)` signature, so
     * the table is really "which ES date format maps to which moment format,
     * and is it strict".
     */
    const expectedArguments: Record<string, unknown[]> = {
      basic_date: [utcDate, "YYYYMMDD", true],
      basic_date_time: [utcDate, String.raw`YYYYMMDD\THHmmss.SSSZ`, true],
      basic_date_time_no_millis: [utcDate, String.raw`YYYYMMDD\THHmmssZ`, true],
      basic_ordinal_date: [utcDate, "YYYYDDD", true],
      basic_ordinal_date_time: [
        utcDate,
        String.raw`YYYYDDD\THHmmss.SSSZ`,
        true,
      ],
      basic_ordinal_date_time_no_millis: [
        utcDate,
        String.raw`YYYYDDD\THHmmssZ`,
        true,
      ],
      basic_t_time: [utcDate, String.raw`\THHmmss.SSSZ`, true],
      basic_t_time_no_millis: [utcDate, String.raw`\THHmmssZ`, true],
      basic_time: [utcDate, "HHmmss.SSSZ", true],
      basic_time_no_millis: [utcDate, "HHmmssZ", true],
      basic_week_date: [utcDate, String.raw`gggg\Wwwe`, false],
      basic_week_date_time: [
        utcDate,
        String.raw`gggg\Wwwe\THHmmss.SSSZ`,
        false,
      ],
      basic_week_date_time_no_millis: [
        utcDate,
        String.raw`gggg\Wwwe\THHmmssZ`,
        false,
      ],
      date: [utcDate, "YYYY-MM-DD", false],
      date_hour: [utcDate, String.raw`YYYY-MM-DD\THH`, false],
      date_hour_minute: [utcDate, String.raw`YYYY-MM-DD\THH:mm`, false],
      date_hour_minute_second: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ss`,
        false,
      ],
      date_hour_minute_second_fraction: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ss.SSS`,
        false,
      ],
      date_hour_minute_second_millis: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ss.SSS`,
        false,
      ],
      date_time: [utcDate, String.raw`YYYY-MM-DD\THH:mm:ss.SSSZZ`, false],
      date_time_no_millis: [utcDate, String.raw`YYYY-MM-DD\THH:mm:ssZZ`, false],
      hour: [utcDate, "HH", false],
      hour_minute: [utcDate, "HH:mm", false],
      hour_minute_second: [utcDate, "HH:mm:ss", false],
      hour_minute_second_fraction: [utcDate, "HH:mm:ss.SSS", false],
      hour_minute_second_millis: [utcDate, "HH:mm:ss.SSS", false],
      ordinal_date: [utcDate, "YYYY-DDD", false],
      ordinal_date_time: [utcDate, String.raw`YYYY-DDD\THH:mm:ss.SSSZZ`, false],
      ordinal_date_time_no_millis: [
        utcDate,
        String.raw`YYYY-DDD\THH:mm:ssZZ`,
        false,
      ],
      strict_basic_week_date: [utcDate, String.raw`gggg\Wwwe`, true],
      strict_basic_week_date_time: [
        utcDate,
        String.raw`gggg\Wwwe\THHmmss.SSSZ`,
        true,
      ],
      strict_basic_week_date_time_no_millis: [
        utcDate,
        String.raw`gggg\Wwwe\THHmmssZ`,
        true,
      ],
      strict_date: [utcDate, "YYYY-MM-DD", true],
      strict_date_hour: [utcDate, String.raw`YYYY-MM-DD\THH`, true],
      strict_date_hour_minute: [utcDate, String.raw`YYYY-MM-DD\THH:mm`, true],
      strict_date_hour_minute_second: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ss`,
        true,
      ],
      strict_date_hour_minute_second_fraction: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ss.SSS`,
        true,
      ],
      strict_date_hour_minute_second_millis: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ss.SSS`,
        true,
      ],
      /**
       * The one entry whose expected format is not a literal. The Mocha
       * spec could only compare it against its own `ISO_8601_MOCK`
       * sentinel; the spy sees the real one.
       */
      strict_date_optional_time: [utcDate, moment.ISO_8601, true],
      strict_date_time: [utcDate, String.raw`YYYY-MM-DD\THH:mm:ss.SSSZZ`, true],
      strict_date_time_no_millis: [
        utcDate,
        String.raw`YYYY-MM-DD\THH:mm:ssZZ`,
        true,
      ],
      strict_hour: [utcDate, "HH", true],
      strict_hour_minute: [utcDate, "HH:mm", true],
      strict_hour_minute_second: [utcDate, "HH:mm:ss", true],
      strict_hour_minute_second_fraction: [utcDate, "HH:mm:ss.SSS", true],
      strict_hour_minute_second_millis: [utcDate, "HH:mm:ss.SSS", true],
      strict_ordinal_date: [utcDate, "YYYY-DDD", true],
      strict_ordinal_date_time: [
        utcDate,
        String.raw`YYYY-DDD\THH:mm:ss.SSSZZ`,
        true,
      ],
      strict_ordinal_date_time_no_millis: [
        utcDate,
        String.raw`YYYY-DDD\THH:mm:ssZZ`,
        true,
      ],
      strict_t_time: [utcDate, String.raw`\THH:mm:ss.SSSZZ`, true],
      strict_t_time_no_millis: [utcDate, String.raw`\THH:mm:ssZZ`, true],
      strict_time: [utcDate, "HH:mm:ss.SSSZZ", true],
      strict_time_no_millis: [utcDate, "HH:mm:ssZZ", true],
      strict_week_date: [utcDate, String.raw`gggg-\Www-e`, true],
      strict_week_date_time: [
        utcDate,
        String.raw`gggg-\Www-e\THH:mm:ss.SSSZZ`,
        true,
      ],
      strict_week_date_time_no_millis: [
        utcDate,
        String.raw`gggg-\Www-e\THH:mm:ssZZ`,
        true,
      ],
      strict_weekyear: [utcDate, "gggg", true],
      strict_weekyear_week: [utcDate, "ggggww", true],
      strict_weekyear_week_day: [utcDate, "ggggwwe", true],
      strict_year: [utcDate, "YYYY", true],
      strict_year_month: [utcDate, "YYYYMM", true],
      strict_year_month_day: [utcDate, "YYYYMMDD", true],
      t_time: [utcDate, String.raw`\THH:mm:ss.SSSZZ`, false],
      t_time_no_millis: [utcDate, String.raw`\THH:mm:ssZZ`, false],
      time: [utcDate, "HH:mm:ss.SSSZZ", false],
      time_no_millis: [utcDate, "HH:mm:ssZZ", false],
      week_date: [utcDate, String.raw`gggg-\Www-e`, false],
      week_date_time: [utcDate, String.raw`gggg-\Www-e\THH:mm:ss.SSSZZ`, false],
      week_date_time_no_millis: [
        utcDate,
        String.raw`gggg-\Www-e\THH:mm:ssZZ`,
        false,
      ],
      weekyear: [utcDate, "gggg", false],
      weekyear_week: [utcDate, "ggggww", false],
      weekyear_week_day: [utcDate, "ggggwwe", false],
      year: [utcDate, "YYYY", false],
      year_month: [utcDate, "YYYYMM", false],
      year_month_day: [utcDate, "YYYYMMDD", false],
    };

    /** Whatever the format, the parse is declared to have succeeded. */
    const parsed = { isValid: () => true } as Moment;

    beforeEach(() => {
      for (const spy of Object.values(momentStub.spies)) {
        spy.mockReset();
      }

      momentStub.spies.utc.mockReturnValue(parsed);
      momentStub.spies.invalid.mockReturnValue(parsed);
      momentStub.spies.unix.mockImplementation((date: unknown) => date);
    });

    afterEach(() => {
      momentStub.passThrough();
    });

    // `epoch_second` and `epoch_millis` take a number rather than a string, so
    // they route through `moment.unix` / `moment.invalid` instead of a format.
    for (const format of ["epoch_second", "epoch_millis"]) {
      const now = format === "epoch_second" ? Date.now() / 1000 : Date.now();

      it(`gets proper arguments for format "${format}"`, () => {
        const errors: string[] = [];

        dateType.validate({ formats: [format] }, now, errors);

        expect(errors).toEqual([]);
        expect(momentStub.spies.unix).toHaveBeenCalledTimes(
          format === "epoch_second" ? 1 : 0,
        );
        expect(momentStub.spies.utc).toHaveBeenCalledWith(now);

        momentStub.spies.utc.mockClear();
        momentStub.spies.invalid.mockClear();
        momentStub.spies.unix.mockClear();

        dateType.validate({ formats: [format] }, String(now), errors);

        expect(momentStub.spies.utc).not.toHaveBeenCalled();
        expect(momentStub.spies.unix).not.toHaveBeenCalled();
        expect(momentStub.spies.invalid).toHaveBeenCalledOnce();
      });
    }

    for (const [format, expected] of Object.entries(expectedArguments)) {
      it(`gets proper arguments for format "${format}"`, () => {
        const errors: string[] = [];

        dateType.validate({ formats: [format] }, utcDate, errors);

        expect(errors).toEqual([]);
        expect(momentStub.spies.utc).toHaveBeenCalledWith(...expected);
        expect(momentStub.spies.invalid).not.toHaveBeenCalled();
      });
    }
  });
});
