import { Service } from "../service";

export class VirtualIndex extends Service {
  public static createEvent = "core:storage:virtual-index:cache:create";
  public static deleteEvent = "core:storage:virtual-index:cache:delete";

  public static createVirtualIndexEvent =
    "core:storage:virtual-index:create:after";

  public static deleteVirtualIndexEvent =
    "core:storage:virtual-index:delete:after";

  constructor() {
    super("VirtualIndex", global.kuzzle.config.services.storageEngine);
  }

  public virtualIndexMap: Map<string, string> = new Map(); //Key : virtual index, value : real index

  async init(): Promise<void> {
    await this.buildCollection();
    await this.initVirtualIndexList();

    global.kuzzle.onAsk(VirtualIndex.createEvent, (physical, virtual) =>
      this.addInSoftIndexMap(physical, virtual)
    );

    global.kuzzle.onAsk(VirtualIndex.deleteEvent, (info) =>
      this.removeInSoftIndexMap(info)
    );
  }

  addInSoftIndexMap(physical, virtual) {
    this.virtualIndexMap.set(virtual, physical);
  }

  removeInSoftIndexMap(notification) {
    this.virtualIndexMap.delete(notification);
  }

  getRealIndex(name: string): string {
    if (this.virtualIndexMap.has(name)) {
      return this.virtualIndexMap.get(name);
    }
    return name;
  }

  isVirtual(name: string): boolean {
    return this.virtualIndexMap.has(name);
  }

  getId(index: string, id: string): string {
    if (this.isVirtual(index)) {
      return index + id;
    }
    return id;
  }

  randomString(size = 20) {
    const buf = Buffer.alloc(size);
    for (let i = 0; i < 20; i++) {
      buf.writeUInt8((Math.random() * 255) & 255, i);
    }
    return buf.toString("base64").slice(0, size);
  }

  getVirtualId(index: string, id: string): string {
    if (this.isVirtual(index) && id.startsWith(index)) {
      return id.substring(index.length, id.length);
    }
    return id;
  }

  public async createVirtualIndex(virtualIndex: string, index: string) {
    global.kuzzle.emit(VirtualIndex.createVirtualIndexEvent, {
      physical: index,
      virtual: virtualIndex,
    });

    this.virtualIndexMap.set(virtualIndex, index);
    await global.kuzzle.ask(
      "core:storage:private:document:create",
      "virtual-indexes",
      "list",
      { physical: index, virtual: virtualIndex },
      { id: index + virtualIndex }
    );
  }

  async removeVirtualIndex(index: string) {
    const realIndex = this.virtualIndexMap.get(index);
    global.kuzzle.emit(VirtualIndex.deleteVirtualIndexEvent, {
      virtual: index,
    });
    this.virtualIndexMap.delete(index);
    const id = realIndex + index;
    await global.kuzzle.ask(
      "core:storage:private:document:delete",
      "virtual-indexes",
      "list",
      id
    );
  }

  async initVirtualIndexList() {
    if (this.virtualIndexMap.size === 0) {
      return;
    }
    this.virtualIndexMap = new Map<string, string>();
    let from = 0;
    let total;

    do {
      const list = await global.kuzzle.ask(
        "core:storage:private:document:search",
        "virtual-indexes",
        "list",
        { from: from, size: 100 }
      );
      total = list.total;
      for (const hit of list.hits) {
        this.virtualIndexMap.set(hit._source.virtual, hit._source.physical);
      }
      from += 100;
    } while (from < total);
  }

  async buildCollection() {
    try {
      await global.kuzzle.ask(
        "core:storage:private:index:create",
        "virtual-indexes",
        {}
      );
    } catch (e) {
      if (e.status !== 412) {
        //already created
        throw e;
      }
    }
    try {
      await global.kuzzle.ask(
        "core:storage:private:collection:create",
        "virtual-indexes",
        "list",
        {
          mappings: {
            _meta: undefined,
            dynamic: "strict",
            properties: {
              physical: { type: "text" },
              virtual: { type: "text" },
            },
          },
        }
      );
    } catch (e) {
      if (e.status !== 412) {
        //already created
        throw e;
      }
    }
  }

  sanitizeSearchBodyForVirtualIndex(originalSearchBody, index) {
    const filteredQuery = {
      bool: {
        filter: [],
        must: {},
        should: null,
      },
    };
    const searchBody = JSON.parse(JSON.stringify(originalSearchBody));
    if (searchBody.query.bool) {
      filteredQuery.bool = searchBody.query.bool;
      if (!filteredQuery.bool.filter) {
        filteredQuery.bool.filter = []; //add query bool in filter
      } else if (!Array.isArray(filteredQuery.bool.filter)) {
        filteredQuery.bool.filter = [filteredQuery.bool.filter];
      }
    } else {
      filteredQuery.bool.must = searchBody.query;
    }
    filteredQuery.bool.filter.push({
      //TODO : Not perfect solution if request contain a should
      term: {
        "_kuzzle_info.index": index,
      },
    });
    if (filteredQuery.bool.should) {
      filteredQuery.bool.filter.push({
        bool: {
          should: filteredQuery.bool.should,
        },
      });
      delete filteredQuery.bool.should;
    }
    searchBody.query = JSON.parse(JSON.stringify(filteredQuery));
    return searchBody;
  }
}
