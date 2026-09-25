import { vi } from "vitest";

import { IdCard } from "../../lib/cluster/idCardHandler";

/**
 * The five collaborators `ClusterNode` builds in its constructor, plus the
 * mutex its handshake takes.
 *
 * ⚠️ This file must import nothing that reaches `lib/cluster/node.ts`: it is
 * what the `vi.mock` factories load, and a factory whose graph reaches the
 * mocked module deadlocks vitest at collection time (step 13, L4a).
 * `idCardHandler` is safe — the subject imports it, not the other way round.
 */
export class ClusterPublisherStub {
  public init = vi.fn(async () => undefined);
  public dispose = vi.fn(async () => undefined);

  public send = vi.fn<(topic: string, payload: unknown) => unknown>();
  public sendAddCollection = vi.fn();
  public sendAddIndex = vi.fn();
  public sendClusterWideEvent = vi.fn();
  public sendDocumentNotification = vi.fn();
  public sendDumpRequest = vi.fn();
  public sendHeartbeat = vi.fn();
  public sendNewAuthStrategy = vi.fn();
  public sendNewRealtimeRoom = vi.fn();
  public sendNodeEvicted = vi.fn<(...args: string[]) => unknown>();
  public sendNodeShutdown = vi.fn();
  public sendRemoveAuthStrategy = vi.fn();
  public sendRemoveCollection = vi.fn();
  public sendRemoveIndexes = vi.fn();
  public sendRemoveRealtimeRoom = vi.fn<(roomId: string) => unknown>();
  public sendSubscription = vi.fn();
  public sendUnsubscription = vi.fn();
  public sendUserNotification = vi.fn();
}

export class ClusterSubscriberStub {
  /**
   * Whether `waitForSubscription` answers true, for the whole class.
   *
   * The Mocha spec set `__waitForSubscription` on the prototype and deleted it
   * afterwards; a static flag says the same thing and cannot be left behind by
   * a `delete` that never runs.
   */
  static subscriptionProven = true;

  /**
   * When set, the proof arrives this many ms after the wait starts — the
   * remote node's next heartbeat — and `waitForSubscription` honours its
   * timeout the way the real one does. For specs running on fake timers.
   */
  static proofDelay: number | null = null;

  public init = vi.fn(async () => undefined);
  public dispose = vi.fn();
  public sync = vi.fn<(lastMessageId: unknown) => Promise<boolean>>(
    async () => true,
  );
  public waitForSubscription = vi.fn(async (timeout: number) => {
    const delay = ClusterSubscriberStub.proofDelay;

    if (delay === null) {
      return ClusterSubscriberStub.subscriptionProven;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(delay, timeout)),
    );

    return delay <= timeout;
  });
  public remoteNodeIP = "1.2.3.4";

  constructor(
    public __node: unknown,
    public __id: string,
    public __ip: string,
  ) {}
}

export class ClusterCommandStub {
  public init = vi.fn(async () => undefined);
  public dispose = vi.fn();
  public broadcastHandshake = vi.fn<
    (idCards: unknown[]) => Promise<Record<string, unknown>>
  >(async () => ({}));
  public getFullState = vi.fn<() => Promise<unknown>>(async () => ({}));
}

export class ClusterStateStub {
  public addAuthStrategy = vi.fn<(strategy: unknown) => void>();
  public addRealtimeRoom =
    vi.fn<
      (
        roomId: string,
        index: string,
        collection: string,
        filters: unknown,
        meta: unknown,
      ) => void
    >();
  public addRealtimeSubscription =
    vi.fn<(roomId: string, nodeId: string, messageId: unknown) => void>();
  public countRealtimeSubscriptions = vi.fn<
    (roomId: string) => Promise<number>
  >(async () => 12);
  public getNormalizedFilters = vi.fn<(roomId: string) => unknown>();
  public loadFullState = vi.fn<(state: unknown) => Promise<void>>(
    async () => undefined,
  );
  public listRealtimeRooms = vi.fn();
  public removeAuthStrategy = vi.fn<(name: string) => void>();
  public removeNode = vi.fn();
  public removeRealtimeRoom = vi.fn<(roomId: string, nodeId: string) => void>();
  public removeRealtimeSubscription =
    vi.fn<(roomId: string, nodeId: string, messageId: unknown) => void>();
  public serialize = vi.fn();
}

export class IdCardHandlerStub {
  public nodeId = "foonode";
  public idCard = new IdCard({
    birthdate: 120,
    id: "foonode",
    ip: "2.3.4.1",
    topology: [],
  });

  public addNode = vi.fn<(id: string) => Promise<void>>(async () => undefined);
  public createIdCard = vi.fn<() => Promise<void>>(async () => undefined);
  public dispose = vi.fn(async () => undefined);
  public getRemoteIdCards = vi.fn<() => Promise<IdCard[]>>(async () => []);
  public removeNode = vi.fn<(id: string) => Promise<void>>(
    async () => undefined,
  );
}

/** Records every mutex the subject takes, so a spec can read its timeout. */
export class MutexStub {
  static instances: MutexStub[] = [];

  public lock = vi.fn(async () => undefined);
  public unlock = vi.fn(async () => undefined);
  public timeout: number;

  constructor(
    public resource: string,
    options: { timeout?: number } = {},
  ) {
    this.timeout = options.timeout ?? -1;
    MutexStub.instances.push(this);
  }
}
