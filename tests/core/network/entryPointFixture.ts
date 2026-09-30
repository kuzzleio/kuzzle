/**
 * The three protocols `EntryPoint` builds at `init()`.
 *
 * They live in their own file importing nothing from `lib/`: a `vi.mock`
 * factory whose graph reaches the mocked module deadlocks at collection time
 * (step 13, L4b3).
 */
import { vi } from "vitest";

class FakeProtocol {
  public initCalled = false;
  public init = vi.fn(async () => {
    this.initCalled = true;

    return true;
  });
  public joinChannel = vi.fn();
  public leaveChannel = vi.fn();
  public broadcast = vi.fn();
  public notify = vi.fn();

  constructor(public name: string) {}
}

export class FakeHttpWsProtocol extends FakeProtocol {
  constructor() {
    super("websocket");
  }
}

export class FakeMqttProtocol extends FakeProtocol {
  constructor() {
    super("mqtt");
  }
}

export class FakeInternalProtocol extends FakeProtocol {
  constructor() {
    super("internal");
  }
}
