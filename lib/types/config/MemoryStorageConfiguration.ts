export type MemoryStorageConfiguration = {
    /**
     * @default 'redis'
    */
    backend: string
    
    clusterOptions: {
    /**
     * @default true
    */
    enableReadyCheck: boolean
    }
  
    /**
    * @default 5
    */
    database: number
  }
  