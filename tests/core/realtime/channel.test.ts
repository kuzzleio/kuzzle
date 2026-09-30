import { describe, expect, it } from "vitest";

import { Channel } from "../../../lib/core/realtime/channel";
import type { ChannelScope } from "../../../lib/core/realtime/channel";
import type { RealtimeUsers } from "../../../lib/types";

describe("#core/realtime/Channel", () => {
  const roomId = "room";

  describe("#name", () => {
    /**
     * A channel is documented as a subscription configuration's unique
     * identifier, and `Room.createChannel` keeps the first channel registered
     * under a name — so two configurations sharing one is a subscriber
     * silently getting another's notifications. `users: "out"` and
     * `users: "none"` did (TD-74).
     */
    it('should tell `users: "out"` from `users: "none"` — TD-74', () => {
      expect(new Channel(roomId, { users: "out" }).name).not.toBe(
        new Channel(roomId, { users: "none" }).name,
      );
    });

    it("should give every configuration its own name", () => {
      const scopes: ChannelScope[] = ["all", "in", "out", "none"];
      const users: RealtimeUsers[] = ["all", "in", "out", "none"];
      const names = new Set<string>();

      for (const scope of scopes) {
        for (const user of users) {
          for (const propagate of [true, false]) {
            names.add(
              new Channel(roomId, { propagate, scope, users: user }).name,
            );
          }
        }
      }

      expect(names.size).toBe(scopes.length * users.length * 2);
    });

    /**
     * Only `users: "out"` changed name with TD-74's fix; the default — and
     * every other configuration — is named as it always was.
     */
    it("should keep the default configuration's name", () => {
      expect(new Channel(roomId).name).toBe(`${roomId}-311`);
      expect(new Channel(roomId, { scope: "none" }).name).toBe(`${roomId}-31`);
      expect(new Channel(roomId, { users: "out" }).name).toBe(`${roomId}-411`);
    });
  });

  describe("#constructor", () => {
    it('should accept `scope: "none"`', () => {
      expect(new Channel(roomId, { scope: "none" }).scope).toBe("none");
    });

    it("should reject an unknown scope", () => {
      expect(
        () =>
          new Channel(roomId, {
            // @ts-expect-error -- the invalid input under test
            scope: "sideways",
          }),
      ).toThrow(expect.objectContaining({ id: "core.realtime.invalid_scope" }));
    });

    it("should reject unknown users", () => {
      expect(
        () =>
          new Channel(roomId, {
            // @ts-expect-error -- the invalid input under test
            users: "some",
          }),
      ).toThrow(expect.objectContaining({ id: "core.realtime.invalid_users" }));
    });
  });
});
