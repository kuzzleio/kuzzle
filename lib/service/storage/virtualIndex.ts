import Crypto from "crypto";

import { Service } from "../service";

export class VirtualIndex extends Service {
  public static createEvent = "core:storage:virtualindex:cache:create";
  public static deleteEvent = "core:storage:virtualindex:cache:delete";

  public static createVirtualIndexEvent =
    "core:storage:virtualindex:create:after";

  public static deleteVirtualIndexEvent =
    "core:storage:virtualindex:delete:after";

  constructor() {
    super("VirtualIndex", global.kuzzle.config.services.storageEngine);
  }

  public softTenant: Map<string, string> = new Map(); //Key : virtual index, value : real index //TODO rename!

  async init(): Promise<void> {
    await this.buildCollection();
    await this.initVirtualTenantList();

    global.kuzzle.onAsk(VirtualIndex.createEvent, (real, virtual) =>
      this.addInSoftTenantMap(real, virtual)
    );

    global.kuzzle.onAsk(VirtualIndex.deleteEvent, (info) =>
      this.removeInSoftTenantMap(info)
    );
  }

  addInSoftTenantMap(real, virtual) {
    this.softTenant.set(virtual, real);
  }

  removeInSoftTenantMap(notification) {
    this.softTenant.delete(notification);
  }

  getRealIndex(name: string): string {
    if (this.softTenant.has(name)) {
      return this.softTenant.get(name);
    }
    return name;
  }

  isVirtual(name: string): boolean {
    return this.softTenant.has(name);
  }

  getId(index: string, id: string): string {
    if (this.isVirtual(index)) {
      return index + id;
    }
    return id;
  }

  randomString(size = 20) {
    return Crypto.randomBytes(size).toString("base64").slice(0, size);
  }

  getVirtualId(index: string, id: string): string {
    if (this.isVirtual(index) && id.startsWith(index)) {
      return id.substring(index.length, id.length);
    }
    return id;
  }

  public async createVirtualIndex(virtualIndex: string, index: string) {
    //TODO : cluster //TODO : throw exception if "index" is virtual

    global.kuzzle.emit(VirtualIndex.createVirtualIndexEvent, {
      real: index,
      virtual: virtualIndex,
    });

    this.softTenant.set(virtualIndex, index);
    await global.kuzzle.ask(
      "core:storage:private:document:create",
      "virtualindexes",
      "list",
      { real: index, virtual: virtualIndex },
      { id: index + virtualIndex }
    );
  }

  async removeVirtualIndex(index: string) {
    const realIndex = this.softTenant.get(index);
    global.kuzzle.emit(VirtualIndex.deleteVirtualIndexEvent, {
      virtual: index,
    });
    this.softTenant.delete(index);
    const id = realIndex + index;
    await global.kuzzle.ask(
      "core:storage:private:document:delete",
      "virtualindexes",
      "list",
      id
    );
  }

  async initVirtualTenantList() {
    //TODO : from database
    if (this.softTenant.size === 0) {
      this.softTenant = new Map<string, string>();
      let from = 0;
      let total = Number.MAX_VALUE;

      do {
        const list = await global.kuzzle.ask(
          "core:storage:private:document:search",
          "virtualindexes",
          "list",
          { from: from, size: 100 }
        );
        total = list.total;
        for (const hit of list.hits) {
          this.softTenant.set(hit._source.virtual, hit._source.real);
        }
        from += 100;
      } while (from < total);
    }
  }

  async buildCollection() {
    try {
      await global.kuzzle.ask(
        "core:storage:private:index:create",
        "virtualindexes",
        {}
      );
    } catch (e) {
      //already created
    }
    try {
      await global.kuzzle.ask(
        "core:storage:private:collection:create",
        "virtualindexes",
        "list",
        {
          mappings: {
            _meta: undefined,
            dynamic: "strict",
            properties: {
              real: { type: "text" },
              virtual: { type: "text" },
            },
          },
        }
      );
    } catch (e) {
      //already created
    }
  }
}
