Feature: Bulk Controller

  # bulk:import ================================================================

  @mappings
  Scenario: Bulk import of documents
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I perform a bulk import with the following:
      | { "index": {} }                     |
      | { "document": "generatedId" }       |
      | { "index": { "_id": "my-id" } }     |
      | { "document": "indexId" }           |
      | { "create": { "_id": "other-id" } } |
      | { "document": "createId" }          |
      | { "update": { "_id": "other-id" } } |
      | { "doc": { "newField": 42 } }       |
    Then I should receive a bulk result matching:
      | { "index": { "status": 201 } }                     |
      | { "index": { "status": 201, "_id": "my-id" } }     |
      | { "create": { "status": 201, "_id": "other-id" } } |
      | { "update": { "status": 200, "_id": "other-id" } } |
    And The document "other-id" content match:
      | document | "createId" |
      | newField | 42         |

  @mappings
  Scenario: Bulk import with errors
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I perform a bulk import with the following:
      | { "index": {} }                      |
      | { "document": "generatedId" }        |
      | { "create": { "_id": "other-id" } }  |
      | { "document": "createId" }           |
      | { "update": { "_id": "no-id" } }     |
      | { "doc": { "newField": 42 } }        |
      | { "delete": { "_id": "not-found" } } |
    Then I should receive a bulk result matching:
      | { "index": { "status": 201 } }                     |
      | { "create": { "status": 201, "_id": "other-id" } } |
    And I should receive a bulk error matching:
      | { "update": { "status": 404, "_id": "no-id", "_source": { "newField": 42 } } } |
      | { "delete": { "status": 404, "_id": "not-found" } }                            |
