const mutexes = {};

async function _yield() {}

class AsyncMutex {
  constructor(resource) {
    this.resource = resource;
    this.acquired = false;
  }

  async lock(wait = false) {
    if (this.acquired) {
      return;
    }

    if (mutexes[this.resource] && !wait) {
      return false;
    }
      
    while (mutexes[this.resource]) {
      await _yield();
    }

    this.acquired = true,
    mutexes[this.resource] = true;
    return true;
  }

  async unlock() {
    if (this.acquired) {
      mutexes[this.resource] = false;
      this.acquired = false;
    }
  }
}

module.exports = AsyncMutex;