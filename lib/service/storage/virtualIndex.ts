import Crypto from 'crypto';
import { ClientAdapter } from '../../core/storage/clientAdapter';

import Service from '../service';

export class VirtualIndex extends Service {

  public static createEvent = 'virtualindex:create';

  constructor () {
    super('VirtualIndex', global.kuzzle.config.services.storageEngine);
  }


  public softTenant: Map<string, string> = new Map; //Key : virtual index, value : real index
  private clientAdapter: ClientAdapter;


  async initWithClient (clientAdapter: ClientAdapter) : Promise<void>{
    this.clientAdapter = clientAdapter;
    await this.buildCollection();
    await this.initVirtualTenantList();

    await global.kuzzle.ask('cluster:event:on', VirtualIndex.createEvent, info => this.editSoftTenantMap(info));

  }

  editSoftTenantMap (notification) {
    if (notification.action === 'create' || notification.action === 'update') {
      const source = notification.result._source;
      this.softTenant.set(source.real, source.virtual);
    }
  }

  getRealIndex (name: string): string {
    if (this.softTenant.has(name)) {
      return this.softTenant.get(name);
    }
    return name;
  }

  isVirtual (name: string): boolean {
    return this.softTenant.has(name);
  }

  getId (index: string, id: string): string {
    if (this.isVirtual(index)) {
      return index + id;
    }
    return id;
  }

  randomString (size = 20) {
    return Crypto
      .randomBytes(size)
      .toString('base64')
      .slice(0, size);
  }

  getVirtualId (index: string, id: string): string {
    if (this.isVirtual(index) && id.startsWith(index)) {
      return id.substring(index.length, id.length);
    }
    return id;
  }


  public async createVirtualIndex (virtualIndex: string, index: string) { //TODO : cluster //TODO : throw exception if "index" is virtual
    await global.kuzzle.ask('cluster:event:broadcast', VirtualIndex.createEvent, { real: index, virtual: virtualIndex });
    this.editSoftTenantMap( { real: index, virtual: virtualIndex });
    await global.kuzzle.ask(
      'core:storage:private:document:create',
      'virtual-indexes',
      'list',
      { real: index, virtual: virtualIndex });

  }

  removeVirtualIndex (index: string) {//TODO : persistance
    this.softTenant.delete(index);
  }

  async initVirtualTenantList () { //TODO : from database
    if (this.softTenant.size === 0) {
      this.softTenant = new Map<string, string>();
      //this.softTenant.set("virtual-index", "hard-index"); //TODO : micro-controller
      this.softTenant.set('virtual-index-2', 'index2'); //TODO : remove?
      this.softTenant.set('virtual-index-3', 'index2'); //TODO : remove?
      let from = 0;
      let total = Number.MAX_VALUE;


      do {
        const list = await global.kuzzle.ask('core:storage:private:document:search',
          'virtual-indexes',
          'list',
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

  async buildCollection () {
    try {
      await this.clientAdapter.createIndex('virtual-indexes'); //Replace with kuzzle.ask()
    }
    catch (e) {

    }
    try {
      await this.clientAdapter.createCollection('virtual-indexes', 'list', { //Replace with kuzzle.ask()
        mappings: {
          _meta: undefined,
          dynamic: 'strict',
          properties: {
            real: { type: 'text' },
            virtual: { type: 'text' }
          },
        }
      });

    }
    catch (e) {
    }
  }

}