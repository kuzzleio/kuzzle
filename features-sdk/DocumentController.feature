Feature: Document Controller

  # document:create ============================================================

  Scenario: Rejected document because of strict mapping
    Given an index "nyc-open-data"
    And I "create" the collection "nyc-open-data":"strict-taxi" with:
      | mappings | { "dynamic": "strict" } |
    When I execute the action "document":"create" with args:
      | index      | "nyc-open-data"       |
      | collection | "strict-taxi"         |
      | body       | { "name": "lehuong" } |
    Then I should receive an error matching:
      | id      | "services.storage.strict_mapping_rejection"                                                                        |
      | message | "Cannot create document. Field \"name\" is not present in collection \"nyc-open-data:strict-taxi\" strict mapping" |


  # document:search ============================================================

  @mappings
  Scenario: Search with highlight
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
      | -            | { "name": "document2", "age": 21 } |
    And I refresh the collection
    When I search documents with the following query:
      """
      {
        "match": {
          "name": "document1"
        }
      }
      """
    And with the following highlights:
      """
      {
        "fields": {
          "name": {}
        }
      }
      """
    And I execute the search query
    Then I should receive a "hits" array of objects matching:
      | _id          | highlight                            |
      | "document-1" | { "name": [ "<em>document1</em>" ] } |
    When I search documents with the following query:
      """
      {
        "match": {
          "name": "document1"
        }
      }
      """
    And with the following highlights:
      """
      {
        "fields": {
          "name": {}
        }
      }
      """
    And I execute the search query with verb "GET"
    Then I should receive a "hits" array of objects matching:
      | _id          | highlight                            |
      | "document-1" | { "name": [ "<em>document1</em>" ] } |

  @mappings
  Scenario: Search with search_after
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
      | "document-2" | { "name": "document2", "age": 21 } |
      | "document-3" | { "name": "document2", "age": 84 } |
    And I refresh the collection
    When I search documents with the following search body:
      """
      {
        "search_after": [
          42
        ],
        "sort": [
          {
            "age": "asc"
          }
        ]
      }
      """
    And I execute the search query
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "document-3" |

  @mappings
  Scenario: Search with scroll
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
      | "document-3" | { "name": "document3" } |
    And I refresh the collection
    When I search documents with the following query:
      """
      {}
      """
    And with the following search options:
      """
      {
        "scroll": "30s",
        "size": 1
      }
      """
    And I execute the search query
    Then I should receive a result matching:
      | remaining | 2 |
      | total     | 3 |
    And I should receive a "hits" array containing 1 elements
    When I scroll to the next page
    Then I should receive a result matching:
      | remaining | 1 |
      | total     | 3 |
    And I should receive a "hits" array containing 1 elements
    When I scroll to the next page
    Then I should receive a result matching:
      | remaining | 0 |
      | total     | 3 |
    And I should receive a "hits" array containing 1 elements

  @mappings
  Scenario: Search with Koncorde filters
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                                                |
      | "document-1" | { "name": "Melis", "age": 25, "city": "Istanbul" }  |
      | -            | { "age": 25, "city": "Istanbul" }                   |
      | -            | { "name": "Aschen", "age": 27, "city": "Istanbul" } |
    And I refresh the collection
    When I search documents with the following query:
      """
      {
        "and": [
          {
            "equals": {
              "city": "Istanbul"
            }
          },
          {
            "exists": "name"
          },
          {
            "not": {
              "range": {
                "age": {
                  "gt": 25
                }
              }
            }
          }
        ]
      }
      """
    And with the following search options:
      """
      {
        "lang": "koncorde"
      }
      """
    And I execute the search query
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "document-1" |

  # document:exists ============================================================

  @mappings
  Scenario: Check document existence
    Given an existing collection "nyc-open-data":"yellow-taxi"
    Then The document "document-1" should not exist
    When I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
    Then The document "document-1" should exist
    When I "delete" the following document ids:
      | "document-1" |
    And I refresh the collection
    Then The document "document-1" should not exist

  # document:mCreate ===========================================================

  @mappings
  Scenario: Create multiple documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | -            | { "name": "document2" } |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 | status | result    |
      | "document-1" | { "name": "document1" } | 201    | "created" |
      | -            | { "name": "document2" } | 201    | "created" |
    And I should receive a empty "errors" array
    And I refresh the collection
    And I count 2 documents
    And The document "document-1" content match:
      | name | "document1" |

  @mappings
  Scenario: Create multiple documents with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I can create the following document:
      | _id  | "document-1"                       |
      | body | { "name": "document1", "age": 42 } |
    When I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "replaced1" } |
      | "document-2" | { "name": "document2" } |
      | -            | "not a body"            |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 | status | result    |
      | "document-2" | { "name": "document2" } | 201    | "created" |
    And I should receive a "errors" array of objects matching:
      | reason                            | status | document                                                 |
      | "document body must be an object" | 400    | { "body": "not a body" }                                 |
      | "document already exists"         | 400    | { "_id": "document-1", "body": { "name": "replaced1" } } |
    And The document "document-1" content match:
      | name | "document1" |
    And The document "document-2" content match:
      | name | "document2" |

  # document:mCreateOrReplace ==================================================

  @mappings
  Scenario: CreateOrReplace multiple documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
    When I "createOrReplace" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "replaced1" } |
      | -            | { "name": "document2" } |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 | status | result    |
      | "document-1" | { "name": "replaced1" } | 200    | "updated" |
      | -            | { "name": "document2" } | 201    | "created" |
    And I should receive a empty "errors" array
    And I refresh the collection
    And I count 2 documents
    And The document "document-1" content match:
      | name | "replaced1" |

  @mappings
  Scenario: CreateOrReplace multiple documents with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I "createOrReplace" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | -            | "not a body"            |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 | status | result    |
      | "document-1" | { "name": "document1" } | 201    | "created" |
    And I should receive a "errors" array of objects matching:
      | reason                            | status | document                 |
      | "document body must be an object" | 400    | { "body": "not a body" } |
    And The document "document-1" content match:
      | name | "document1" |


  # document:update ===========================================================
  @mappings
  Scenario: Update document with and without returning updated document
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the document "document-1" with content:
      | name | "document-1" |
      | age  | 42           |
    When I successfully execute the action "document":"update" with args:
      | index      | "nyc-open-data"        |
      | collection | "yellow-taxi"          |
      | _id        | "document-1"           |
      | body       | { "name": "updated1" } |
      | source     | true                   |
    Then I should receive a result matching:
      | _id     | "document-1"                      |
      | _source | { "name": "updated1", "age": 42 } |
    And The document "document-1" content match:
      | name | "updated1" |
      | age  | 42         |
    When I successfully execute the action "document":"update" with args:
      | index      | "nyc-open-data"        |
      | collection | "yellow-taxi"          |
      | _id        | "document-1"           |
      | body       | { "name": "updated2" } |
      | source     | false                  |
    Then I should receive a result matching:
      | _id | "document-1" |
    And The document "document-1" content match:
      | name | "updated2" |
      | age  | 42         |


  # document:mUpdate ===========================================================

  @mappings
  Scenario: Update multiple documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
      | "document-2" | { "name": "document2" }            |
    When I "update" the following documents:
      | _id          | body                   |
      | "document-1" | { "name": "updated1" } |
      | "document-2" | { "age": 21 }          |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                            | _version | status |
      | "document-1" | { "name": "updated1", "age": 42 }  | 2        | 200    |
      | "document-2" | { "name": "document2", "age": 21 } | 2        | 200    |
    And I should receive a empty "errors" array
    And The document "document-1" content match:
      | name | "updated1" |
      | age  | 42         |
    And The document "document-2" content match:
      | name | "document2" |
      | age  | 21          |

  @mappings
  Scenario: Update multiple documents with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
      | "document-2" | { "name": "document2" }            |
    When I "update" the following documents:
      | _id           | body                   |
      | -             | { "name": "updated1" } |
      | "document-42" | { "name": "updated1" } |
      | "document-1"  | { "name": "updated1" } |
      | "document-2"  | "not a body"           |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                           | status |
      | "document-1" | { "name": "updated1", "age": 42 } | 200    |
    And I should receive a "errors" array of objects matching:
      | reason                            | status | document                                                 |
      | "document body must be an object" | 400    | { "_id": "document-2", "body": "not a body" }            |
      | "document _id must be a string"   | 400    | { "body": { "name": "updated1" } }                       |
      | "document not found"              | 404    | { "_id": "document-42", "body": { "name": "updated1" } } |
    And The document "document-1" content match:
      | name | "updated1" |
      | age  | 42         |
    And The document "document-2" content match:
      | name | "document2" |


  # document:mReplace ==========================================================

  @mappings
  Scenario: Replace multiple documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
      | "document-2" | { "name": "document2" }            |
    When I "replace" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "replaced1" } |
      | "document-2" | { "name": "replaced2" } |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 | status |
      | "document-1" | { "name": "replaced1" } | 200    |
      | "document-2" | { "name": "replaced2" } | 200    |
    And I should receive a empty "errors" array
    And The document "document-1" content match:
      | name | "replaced1" |
    And The document "document-2" content match:
      | name | "replaced2" |

  @mappings
  Scenario: Replace multiple documents with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                               |
      | "document-1" | { "name": "document1", "age": 42 } |
      | "document-2" | { "name": "document2" }            |
    When I "replace" the following documents:
      | _id           | body                    |
      | -             | { "name": "replaced1" } |
      | "document-42" | { "name": "replaced1" } |
      | "document-2"  | { "name": "replaced2" } |
      | "document-1"  | "not a body"            |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 | status |
      | "document-2" | { "name": "replaced2" } | 200    |
    And I should receive a "errors" array of objects matching:
      | reason                            | status | document                                                  |
      | "document _id must be a string"   | 400    | { "body": { "name": "replaced1" } }                       |
      | "document body must be an object" | 400    | { "_id": "document-1", "body": "not a body" }             |
      | "document not found"              | 404    | { "_id": "document-42", "body": { "name": "replaced1" } } |
    And The document "document-1" content match:
      | name | "document1" |
      | age  | 42          |
    And The document "document-2" content match:
      | name | "replaced2" |


  # document:mDelete ===========================================================

  @mappings
  Scenario: Delete multiple documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
      | "document-3" | { "name": "document3" } |
    When I "delete" the following document ids:
      | "document-1" |
      | "document-2" |
    Then I should receive a "successes" array matching:
      | "document-1" |
      | "document-2" |
    And I should receive a empty "errors" array
    And The document "document-1" should not exist
    And The document "document-2" should not exist

  @mappings
  Scenario: Delete multiple documents with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
      | "document-3" | { "name": "document3" } |
    When I "delete" the following document ids:
      | "document-1"  |
      | 214284        |
      | "document-42" |
    Then I should receive a "successes" array matching:
      | "document-1" |
    And I should receive a "errors" array of objects matching:
      | reason                          | status | _id           |
      | "document _id must be a string" | 400    | 214284        |
      | "document not found"            | 404    | "document-42" |
    And The document "document-1" should not exist
    And The document "document-2" should exist
    And The document "document-3" should exist

  # document:mGet ==============================================================

  @mappings
  Scenario: Get multiple documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
      | "document-3" | { "name": "document3" } |
    When I "get" the following document ids:
      | "document-1" |
      | "document-2" |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
    And I should receive a empty "errors" array
    When I "get" the following document ids with verb "POST":
      | "document-1" |
      | "document-2" |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
    And I should receive a empty "errors" array


  @mappings
  Scenario: Get multiple documents with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
      | "document-3" | { "name": "document3" } |
    When I "get" the following document ids:
      | "document-1"  |
      | 214284        |
      | "document-42" |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                 |
      | "document-1" | { "name": "document1" } |
    And I should receive a "errors" array matching:
      | "214284"      |
      | "document-42" |

  # document:count =============================================================

  @mappings
  Scenario: Count documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id | body                   |
      | -   | { "job": "developer" } |
      | -   | { "job": "developer" } |
      | -   | { "job": "cto" }       |
    And I refresh the collection
    Then I count 3 documents
    And I count 2 documents matching:
      | job | "developer" |

  # document:delete ============================================================

  @mappings
  Scenario: Delete document
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
      | "document-2" | { "name": "document2" } |
    When I delete the document "document-1"
    Then I should receive a "string" result equals to "document-1"
    Then The document "document-1" should not exist
    Then The document "document-2" should exist

  @mappings
  Scenario: Delete document and retrieve its source
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                    |
      | "document-1" | { "name": "document1" } |
    When I successfully execute the action "document":"delete" with args:
      | index      | "nyc-open-data" |
      | collection | "yellow-taxi"   |
      | _id        | "document-1"    |
      | source     | true            |
    Then I should receive a result matching:
      | _id     | "document-1"            |
      | _source | { "name": "document1" } |
    Then The document "document-1" should not exist

  @mappings
  Scenario: deleteByQuery
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id | body                               |
      | -   | { "name": "document1", "age": 42 } |
      | -   | { "name": "document2", "age": 84 } |
      | -   | { "name": "document2", "age": 21 } |
    And I refresh the collection
    When I successfully execute the action "document":"deleteByQuery" with args:
      | index      | "nyc-open-data"                                   |
      | collection | "yellow-taxi"                                     |
      | body       | { "query": { "range": { "age": { "gt": 21 } } } } |
    Then I should receive a "documents" array containing 2 elements
    And I count 1 documents matching:
      | age | 21 |

  @mappings
  Scenario: deleteByQuery and retrieve sources
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id | body                               |
      | -   | { "name": "document1", "age": 42 } |
      | -   | { "name": "document2", "age": 84 } |
      | -   | { "name": "document2", "age": 21 } |
    And I refresh the collection
    When I successfully execute the action "document":"deleteByQuery" with args:
      | index      | "nyc-open-data"                                   |
      | collection | "yellow-taxi"                                     |
      | source     | true                                              |
      | body       | { "query": { "range": { "age": { "gt": 21 } } } } |
    Then I should receive a "documents" array of objects matching:
      | _source                            |
      | { "name": "document1", "age": 42 } |
      | { "name": "document2", "age": 84 } |
    And I count 1 documents matching:
      | age | 21 |

  @mappings
  Scenario: deleteByQuery with Koncorde filters
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id | body                               |
      | -   | { "name": "document1", "age": 42 } |
      | -   | { "name": "document2", "age": 84 } |
      | -   | { "name": "document2", "age": 21 } |
    And I refresh the collection
    When I successfully execute the action "document":"deleteByQuery" with args:
      | index      | "nyc-open-data"                                   |
      | collection | "yellow-taxi"                                     |
      | body       | { "query": { "range": { "age": { "gt": 21 } } } } |
      | lang       | "koncorde"                                        |
    Then I should receive a "documents" array containing 2 elements
    And I count 1 documents matching:
      | age | 21 |

  @mappings
  Scenario: updateByQuery
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                              |
      | "document-1" | { "name": "Sylvanas Windrunner" } |
      | "document-2" | { "name": "Tirion Fordring" }     |
      | "document-3" | { "name": "Tirion Fordring" }     |
      | "document-4" | { "name": "Sylvanas Windrunner" } |
    And I refresh the collection
    When I successfully execute the action "document":"updateByQuery" with args:
      | index      | "nyc-open-data"                                                                                   |
      | collection | "yellow-taxi"                                                                                     |
      | body       | { "query": { "match": {"name": "Sylvanas Windrunner" } }, "changes": {"title": "The liberator"} } |
    Then I should receive a "successes" array of objects matching:
      | _id          |
      | "document-1" |
      | "document-4" |
    When I "get" the following document ids:
      | "document-1" |
      | "document-4" |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                                                     |
      | "document-1" | { "name": "Sylvanas Windrunner", "title": "The liberator" } |
      | "document-4" | { "name": "Sylvanas Windrunner", "title": "The liberator" } |


  @mappings
  Scenario: UpdateByQuery with Koncorde filters
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following documents:
      | _id          | body                              |
      | "document-1" | { "name": "Sylvanas Windrunner" } |
      | "document-2" | { "name": "Tirion Fordring" }     |
      | "document-3" | { "name": "Tirion Fordring" }     |
      | "document-4" | { "name": "Sylvanas Windrunner" } |
    And I refresh the collection
    When I successfully execute the action "document":"updateByQuery" with args:
      | index      | "nyc-open-data"                                                                                    |
      | collection | "yellow-taxi"                                                                                      |
      | body       | { "query": { "equals": {"name": "Sylvanas Windrunner" } }, "changes": {"title": "The liberator"} } |
      | lang       | "koncorde"                                                                                         |
    Then I should receive a "successes" array of objects matching:
      | _id          |
      | "document-1" |
      | "document-4" |
    When I "get" the following document ids:
      | "document-1" |
      | "document-4" |
    Then I should receive a "successes" array of objects matching:
      | _id          | _source                                                     |
      | "document-1" | { "name": "Sylvanas Windrunner", "title": "The liberator" } |
      | "document-4" | { "name": "Sylvanas Windrunner", "title": "The liberator" } |
