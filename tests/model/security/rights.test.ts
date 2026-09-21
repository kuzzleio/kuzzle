import { describe, expect, it } from "vitest";

import { invalid } from "../../helpers/invalid";

import Rights from "../../../lib/model/security/rights";

describe("#model/security/rights", () => {
  it("merges Rights", () => {
    let result;

    result = Rights.merge(undefined, { value: "allowed" });
    expect(result.value).toBe("allowed");
    result = Rights.merge(undefined, { value: true });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "allowed" }, { value: "allowed" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "allowed" }, { value: true });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: true }, { value: "allowed" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: true }, { value: true });
    expect(result.value).toBe("allowed");
    result = Rights.merge(invalid({ value: { foo: "bar" } }), {
      value: "allowed",
    });
    expect(result.value).toBe("allowed");
    result = Rights.merge(
      invalid({ value: { foo: "bar" } }),
      invalid({ value: true }),
    );
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "denied" }, { value: "allowed" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "denied" }, { value: true });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "foobar" }, { value: "allowed" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "foobar" }, { value: true });
    expect(result.value).toBe("allowed");

    result = Rights.merge({ value: "allowed" }, { value: "denied" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: true }, { value: "denied" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "denied" }, { value: "denied" });
    expect(result.value).toBe("denied");
    result = Rights.merge({ value: "foobar" }, { value: "denied" });
    expect(result.value).toBe("denied");

    result = Rights.merge({ value: "allowed" }, { value: "foobar" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: true }, { value: "foobar" });
    expect(result.value).toBe("allowed");
    result = Rights.merge({ value: "denied" }, { value: "foobar" });
    expect(result.value).toBe("denied");
    result = Rights.merge({ value: "foobar" }, { value: "foobar" });
    expect(result.value).toBe("denied");
  });
});
