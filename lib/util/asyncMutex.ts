const mutexes = new Map<String, boolean>();

async function _yield() {}

export class AsyncMutex {
  private resource: String;
  private acquired: boolean;

  constructor(resource) {
    this.resource = resource;
    this.acquired = false;
  }

  get acquiredByOther(): boolean {
    return !this.acquired && mutexes.get(this.resource);
  }

  async lock(wait = true) {
    if (this.acquired) {
      return true;
    }

    if (mutexes.get(this.resource) && !wait) {
      return false;
    }
      
    while (mutexes.get(this.resource)) {
      await _yield();
    }

    this.acquired = true;
    mutexes.set(this.resource, true);
    return true;
  }

  async unlock() {
    if (this.acquired) {
      mutexes.delete(this.resource);
      this.acquired = false;
    }
  }
}