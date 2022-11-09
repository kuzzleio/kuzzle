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

  /**
   * Key : virtual index,
   * value : real index
   */
  public virtualIndexMap: Map<string, string> = new Map<string, string>();

  async init(): Promise<void> {
    await this.buildCollection();
    await this.initVirtualIndexList();

    global.kuzzle.onAsk(VirtualIndex.createEvent, (physical, virtual) =>
      this.addInVirtualIndexMap(physical, virtual)
    );

    global.kuzzle.onAsk(VirtualIndex.deleteEvent, (info) =>
      this.removeInVirtualIndexMap(info)
    );
  }

  addInVirtualIndexMap(physical, virtual) {
    this.virtualIndexMap.set(virtual, physical);
  }

  removeInVirtualIndexMap(notification) {
    this.virtualIndexMap.delete(notification);
  }

  getPhysicalIndex(name: string): string {
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

  getVirtualId(index: string, id: string): string {
    if (this.isVirtual(index) && id.startsWith(index)) {
      return id.substring(index.length, id.length);
    }
    return id;
  }

  public async createVirtualIndex(virtualIndex: string, index: string) {
    this.virtualIndexMap.set(virtualIndex, index);
    await global.kuzzle.ask(
      "core:storage:private:document:create",
      "kuzzle",
      "virtual-indexes",
      { physical: index, virtual: virtualIndex },
      { id: index + virtualIndex }
    );
    global.kuzzle.emit(VirtualIndex.createVirtualIndexEvent, {
      physical: index,
      virtual: virtualIndex,
    });
  }

  async removeVirtualIndex(index: string) {
    const physicalIndex = this.virtualIndexMap.get(index);

    this.virtualIndexMap.delete(index);
    const id = physicalIndex + index;
    await global.kuzzle.ask(
      "core:storage:private:document:delete",
      "kuzzle",
      "virtual-indexes",
      id
    );
    global.kuzzle.emit(VirtualIndex.deleteVirtualIndexEvent, {
      virtual: index,
    });
  }

  async initVirtualIndexList() {
    let from = 0;
    let total;

    do {
      const list = await global.kuzzle.ask(
        "core:storage:private:document:search",
        "kuzzle",
        "virtual-indexes",
        { from, size: 100 }
      );
      total = 0;
      if (list) {
        total = list.total;
        for (const hit of list.hits) {
          this.virtualIndexMap.set(hit._source.virtual, hit._source.physical);
        }
        from += 100;
      }
    } while (from < total);
  }

  async buildCollection() {
    try {
      await global.kuzzle.ask(
        "core:storage:private:collection:create",
        "kuzzle",
        "virtual-indexes",
        {
          mappings: {
            _meta: undefined,
            dynamic: "strict",
            properties: {
              physical: { type: "keyword" },
              virtual: { type: "keyword" },
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
      //Warning : Not perfect solution if request contain a should
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
