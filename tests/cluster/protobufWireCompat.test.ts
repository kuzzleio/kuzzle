import { describe, expect, it } from "vitest";

import path from "node:path";

import protobuf from "protobufjs";
import protobufV7 from "protobufjs-v7";

/**
 * During a rolling upgrade, nodes on protobufjs 8 and nodes on protobufjs 7
 * share the cluster: every sync message and every command must encode to the
 * same bytes, and decode to the same object, whichever version is on either
 * end.
 *
 * protobufjs 8 stopped encoding — and stopped returning from `toObject()` — a
 * proto3 scalar holding its default value (`""`, `0`, `false`) unless the field
 * tracks presence. protobufjs 7 sent such a field and handed it back. Every
 * singular scalar field of the cluster schemas is therefore declared
 * `optional`, which protobufjs 7 treats exactly like a plain proto3 field, and
 * which makes protobufjs 8 behave like protobufjs 7.
 *
 * This spec walks every message type of both schemas and checks the two
 * versions against each other with every field set, with every field at its
 * default value, and with the largest `uint64`.
 */

const SCHEMAS = ["sync.proto", "command.proto"];
const PROTO_DIR = path.join(__dirname, "../../lib/cluster/protobuf");
const MODES = ["set", "defaults", "largest"] as const;

type Mode = (typeof MODES)[number];
type Payload = Record<string, unknown>;

/**
 * The slice of the reflection API this spec walks. Structural, so that it
 * fits both versions' classes, which TypeScript does not consider compatible.
 */
type ReflectedField = {
  name: string;
  repeated: boolean;
  resolve: () => unknown;
  resolvedType: unknown;
  type: string;
};
type ReflectedType = { fieldsArray: ReflectedField[]; fullName: string };
type ReflectedNamespace = { nestedArray: unknown[] };

const isType = (value: unknown): value is ReflectedType =>
  typeof value === "object" && value !== null && "fieldsArray" in value;

const isNamespace = (value: unknown): value is ReflectedNamespace =>
  typeof value === "object" && value !== null && "nestedArray" in value;

function scalarSample(type: string, name: string, mode: Mode): unknown {
  const atDefault = mode === "defaults";

  switch (type) {
    case "string":
      return atDefault ? "" : `value of ${name} — é`;
    case "bool":
      return !atDefault;
    case "bytes":
      return atDefault ? Buffer.alloc(0) : Buffer.from([1, 2, 3, 250]);
    case "uint32":
      return atDefault ? 0 : 42;
    case "uint64":
      if (atDefault) {
        return 0;
      }

      return mode === "largest" ? "18446744073709551615" : 1234567890123;
    default:
      throw new Error(`no sample for the "${type}" field type`);
  }
}

function sample(type: ReflectedType, mode: Mode): Payload {
  const payload: Payload = {};

  for (const field of type.fieldsArray) {
    field.resolve();

    const value = isType(field.resolvedType)
      ? sample(field.resolvedType, mode)
      : scalarSample(field.type, field.name, mode);

    if (field.repeated) {
      payload[field.name] = mode === "defaults" ? [] : [value, value];
    } else {
      payload[field.name] = value;
    }
  }

  return payload;
}

function messageTypes(
  namespace: ReflectedNamespace,
  found: string[] = [],
): string[] {
  for (const nested of namespace.nestedArray) {
    if (isType(nested)) {
      found.push(nested.fullName.slice(1));
    }

    if (isNamespace(nested)) {
      messageTypes(nested, found);
    }
  }

  return found;
}

function roundTrip<M>(
  type: { decode: (bytes: Uint8Array) => M; toObject: (message: M) => object },
  bytes: Uint8Array,
): string {
  return JSON.stringify(type.toObject(type.decode(bytes)));
}

describe("cluster protobuf schemas: protobufjs 7 / 8 wire compatibility", () => {
  for (const schema of SCHEMAS) {
    const v7 = protobufV7.loadSync(path.join(PROTO_DIR, schema));
    const v8 = protobuf.loadSync(path.join(PROTO_DIR, schema));

    for (const name of messageTypes(v8)) {
      for (const mode of MODES) {
        it(`${name}, ${mode}`, () => {
          const type7 = v7.lookupType(name);
          const type8 = v8.lookupType(name);
          const payload = sample(type8, mode);

          const bytes7 = type7.encode(type7.create(payload)).finish();
          const bytes8 = type8.encode(type8.create(payload)).finish();

          expect(Buffer.from(bytes8).toString("hex")).toBe(
            Buffer.from(bytes7).toString("hex"),
          );

          const decoded = roundTrip(type7, bytes7);

          expect(roundTrip(type7, bytes8)).toBe(decoded);
          expect(roundTrip(type8, bytes7)).toBe(decoded);
          expect(roundTrip(type8, bytes8)).toBe(decoded);
        });
      }
    }
  }

  it("walks every message type of both schemas, nested ones included", () => {
    const names = SCHEMAS.flatMap((schema) =>
      messageTypes(protobuf.loadSync(path.join(PROTO_DIR, schema))),
    );

    expect(names).toContain("sync.Heartbeat");
    expect(names).toContain("sync.NewAuthStrategy.AuthStrategyMethods");
    expect(names).toContain("command.FullStateResponse.Activity");
    expect(names).toContain("command.RetransmitResponse.Frame");
  });
});
