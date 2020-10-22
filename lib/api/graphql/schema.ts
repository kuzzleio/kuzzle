export interface SchemaConfig {
  [indexName: string]: {
    [collectionName: string]: TypeConfig
  }
}

export interface TypeConfig {
  typeName: string
  properties?: {
    [propertyName: string]: TypePropertyConfig
  }
}

export interface TypePropertyConfig {
  isForeingKey?: boolean,
  nullable?: boolean,
  nullableElements?: boolean
  plural?: boolean,
  type?: string
}