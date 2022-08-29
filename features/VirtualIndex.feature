Feature: VirtualIndex

  Scenario: Creation of a virtualIndex and a document on it
    Given an index "realindex"
    When I "create" the collection "realindex":"collection" with:
      | mappings | { "properties": { "name": { "type": "keyword" } } } |
    And I can create the following document:
      | _id  | "document1"             |
      | body | { "name": "document1" } |
    Then I should see the collection "realindex":"collection"
    And The document "document1" content match:
      | name | "document1" |
    When I create a virtual index named "virtual" referencing "realindex"
    Then I should see the collection "virtual":"collection"
    When I can create the following document:
      | _id  | "document2"             |
      | body | { "name": "document2" } |
    Then The document "document2" content match:
      | name | "document2" |
    And The document "realindex":"collection":"virtualdocument2" content match:
      | name | "document2" |

  Scenario: Creation of collection in a virtual Index
    Given an index "realindex2"
    When I create a virtual index named "virtual2" referencing "realindex2"
    When I "create" the collection "virtual2":"collection" with:
      | mappings | { "properties": { "name": { "type": "keyword" } } } |
    Then I should receive an error matching:
      | status | 403 |

  Scenario: Remove a collection in a virtual Index
    Given an index "realindex3"
    When I "create" the collection "realindex3":"collection" with:
      | mappings | { "properties": { "name": { "type": "keyword" } } } |
    And I create a virtual index named "virtual3" referencing "realindex3"
    When I remove the collection "virtual3":"collection"
    Then I should receive an error matching:
      | status | 400 |

    Scenario: Update virtual collection mapping
      Given an index "realindex5"
      When I "create" the collection "realindex5":"collection" with:
        | mappings | { "properties": { "name": { "type": "keyword" } } } |
      And I create a virtual index named "virtual5" referencing "realindex5"
      And I "update" the collection "virtual5":"collection" with:
        | dynamic | "strict" |
      Then I should receive an error matching:
        | status | 403 |

  Scenario: Remove a virtualIndex
    Given an index "realindex4"
    When I "create" the collection "realindex4":"collection" with:
      | mappings | { "properties": { "name": { "type": "keyword" } } } |
    And I create a virtual index named "virtual4" referencing "realindex4"
    Then I can find the index named "virtual4" in index list
    When I can create the following document:
      | _id  | "document1"             |
      | body | { "name": "document1" } |
    And I can create the following document:
      | _id  | "document2"             |
      | body | { "name": "document2" } |
    Then The document "realindex4":"collection":"virtual4document1" content match:
      | name | "document1" |
    And The document "realindex4":"collection":"virtual4document2" content match:
      | name | "document2" |
    #And I refresh the collection
    When I'm able to delete the index named "virtual4"
    Then I can't find the index named "virtual4" in index list
    And The document "realindex4":"collection":"virtual4document2" does not exist
    And The document "realindex4":"collection":"virtual4document2" does not exist

  Scenario: truncate a virtualIndex
    Given an index "realindex6"
    When I "create" the collection "realindex6":"collection" with:
      | mappings | { "properties": { "name": { "type": "keyword" } } } |
    And I create a virtual index named "virtual6" referencing "realindex6"
    When I can create the following document:
      | _id  | "document1"             |
      | body | { "name": "document1" } |
    And I can create the following document:
      | _id  | "document2"             |
      | body | { "name": "document2" } |
    When I create a virtual index named "virtual62" referencing "realindex6"
    And I can create the following document:
      | _id  | "document1"             |
      | body | { "name": "document1" } |
    Then The document "realindex6":"collection":"virtual6document1" content match:
      | name | "document1" |
    And The document "realindex6":"collection":"virtual6document2" content match:
      | name | "document2" |
    And The document "virtual6":"collection":"document1" content match:
      | name | "document1" |
    And The document "virtual6":"collection":"document2" content match:
      | name | "document2" |
    And I refresh the collection
    When I successfully execute the action "collection":"truncate" with args:
      | index      | "virtual6"   |
      | collection | "collection" |
    And  The document "virtual6":"collection":"document1" does not exist
    Then The document "virtual6":"collection":"document2" does not exist
    And The document "realindex6":"collection":"virtual6document1" does not exist
    And The document "realindex6":"collection":"virtual6document2" does not exist
    And  The document "virtual62":"collection":"document1" does exist
    And  The document "realindex6":"collection":"virtual62document1" does exist

  Scenario: list virtualIndexes and physicalIndexes
    Given an index "realindex7"
    And I create a virtual index named "virtual7" referencing "realindex7"
    When I successfully execute the action "index":"list"
    Then I should receive a "indexes" array containing:
      """
      ["virtual7", "realindex7"]
      """
    Then I debug "result"
    When I successfully execute the action "index":"list" with args:
      | onlyVirtual | true |
    Then I should receive a "indexes" array containing:
      """
      ["virtual7"]
      """
    And I should receive a "indexes" array not containing:
      """
      ["realindex7"]
      """
    When I successfully execute the action "index":"list" with args:
      | onlyPhysical | true |
    Then I should receive a "indexes" array containing:
      """
      ["realindex7"]
      """
    And I should receive a "indexes" array not containing:
      """
      ["virtual7"]
      """
