const mutexes = new Map<string, boolean>();

async function _yield (): Promise<void> {
  // This function needs to remain empty
  // Its only purpose is to let the event loop switch to another task
}

export class AsyncMutex {
  private _resource: string;
  private _acquired: boolean;

  constructor (resource: string) {
    this._resource = resource;
    this._acquired = false;
  }

  /**
   * Returns true if the resource is acquired by an other mutex.
   */
  get acquiredByOther (): boolean {
    return ! this._acquired && mutexes.get(this._resource);
  }

  /**
   * Return true if the resource is acquired by this mutex.
   */
  get acquired (): boolean {
    return this._acquired;
  }

  /**
   * Acquire the mutex.
   * @param wait If true, wait until the mutex is available.
   */
  async lock (wait = true): Promise<boolean> {
    if (this._acquired) {
      return true;
    }

    if (! wait && mutexes.get(this._resource)) {
      return false;
    }
      
    while (mutexes.get(this._resource)) {
      // Enters and return from an empty async function so the event loop can switch to another task
      await _yield();
    }

    this._acquired = true;
    mutexes.set(this._resource, true);
    return true;
  }

  /**
   * Release the mutex.
   */
  unlock (): void {
    if (! this._acquired) {
      return;
    }
    mutexes.delete(this._resource);
    this._acquired = false;
  }
}