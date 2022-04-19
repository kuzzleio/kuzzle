Feature: Plugin Events

  @mappings @events
  Scenario: Modify documents with document:generic:beforeWrite
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "activate" the "plugin" pipe on "generic:document:beforeWrite" with the following changes:
      | _source.leaveAt | "'10:30'"              |
      | _id             | "`${document._id}-vn`" |
    # mCreate
    When I "create" the following multiple documents:
      | _id     | body                                               |
      | "bus-1" | { "destination": "Hà Giang", "company": "Cau Me" } |
      | "bus-2" | { "destination": "Sa Pa", "company": "So Viet" }   |
    Then The document "bus-1-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "10:30"    |
    Then The document "bus-2-vn" content match:
      | destination | "Sa Pa"   |
      | company     | "So Viet" |
      | leaveAt     | "10:30"   |
    # mCreateOrReplace
    When I "createOrReplace" the following multiple documents:
      | _id     | body                                               |
      | "bus-3" | { "destination": "Hà Giang", "company": "Cau Me" } |
      | "bus-4" | { "destination": "Sa Pa", "company": "So Viet" }   |
    Then The document "bus-3-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "10:30"    |
    Then The document "bus-4-vn" content match:
      | destination | "Sa Pa"   |
      | company     | "So Viet" |
      | leaveAt     | "10:30"   |
    # Change pipe modifications
    And I "activate" the "plugin" pipe on "generic:document:beforeWrite" with the following changes:
      | _source.leaveAt | "'11:30'"              |
      | _id             | "`${document._id}-vn`" |
    # mReplace
    When I "replace" the following multiple documents:
      | _id     | body                                               |
      | "bus-1" | { "destination": "Hà Giang", "company": "Cau Me" } |
      | "bus-2" | { "destination": "Sa Pa", "company": "So Viet" }   |
    Then The document "bus-1-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "11:30"    |
    Then The document "bus-2-vn" content match:
      | destination | "Sa Pa"   |
      | company     | "So Viet" |
      | leaveAt     | "11:30"   |
    # create
    When I "create" the document "bus-5" with content:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
    Then The document "bus-5-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "11:30"    |
    # createOrReplace
    When I "createOrReplace" the document "bus-6" with content:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
    Then The document "bus-6-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "11:30"    |
    And I "activate" the "plugin" pipe on "generic:document:beforeWrite" with the following changes:
      | _source.leaveAt | "'12:30'"              |
      | _id             | "`${document._id}-vn`" |
    # replace
    When I "replace" the document "bus-5" with content:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
    Then The document "bus-5-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "12:30"    |

  @mappings @events
  Scenario: Modify documents with document:generic:afterWrite
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "activate" the "plugin" pipe on "generic:document:afterWrite" with the following changes:
      | _source.type | "'sleepingBus'"  |
      | _id          | "'confidential'" |
    # mCreate
    When I "create" the following multiple documents:
      | _id     | body                   |
      | "bus-1" | { "duration": "6h" }   |
      | "bus-2" | { "duration": "8h30" } |
    Then I should receive a "successes" array of objects matching:
      | _id            | _source                                       |
      | "confidential" | { "duration": "6h", "type": "sleepingBus" }   |
      | "confidential" | { "duration": "8h30", "type": "sleepingBus" } |
    # mCreateOrReplace
    When I "createOrReplace" the following multiple documents:
      | _id     | body                   |
      | "bus-3" | { "duration": "6h" }   |
      | "bus-4" | { "duration": "8h30" } |
    Then I should receive a "successes" array of objects matching:
      | _id            | _source                                       |
      | "confidential" | { "duration": "6h", "type": "sleepingBus" }   |
      | "confidential" | { "duration": "8h30", "type": "sleepingBus" } |
    # create
    When I "create" the document "bus-5" with content:
      | duration | "6h" |
    Then I should receive a result matching:
      | _id     | "confidential"                              |
      | _source | { "duration": "6h", "type": "sleepingBus" } |
    # createOrReplace
    When I "createOrReplace" the document "bus-6" with content:
      | duration | "6h" |
    Then I should receive a result matching:
      | _id     | "confidential"                              |
      | _source | { "duration": "6h", "type": "sleepingBus" } |
    # Change pipe modifications
    And I "activate" the "plugin" pipe on "generic:document:afterWrite" with the following changes:
      | _source.type | "'localBus'" |
      | _id          | "'redacted'" |
    # mReplace
    When I "replace" the following multiple documents:
      | _id     | body                  |
      | "bus-1" | { "duration": "12h" } |
      | "bus-2" | { "duration": "17h" } |
    Then I should receive a "successes" array of objects matching:
      | _id        | _source                                   |
      | "redacted" | { "duration": "12h", "type": "localBus" } |
      | "redacted" | { "duration": "17h", "type": "localBus" } |
    # replace
    When I "replace" the document "bus-5" with content:
      | duration | "12h" |
    Then I should receive a result matching:
      | _id     | "redacted"                                |
      | _source | { "duration": "12h", "type": "localBus" } |

  @mappings @events
  Scenario: Modify documents with document:generic:beforeUpdate
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following multiple documents:
      | _id        | body                           |
      | "bus-1-vn" | { "destination": "Ninh Binh" } |
      | "bus-2-vn" | { "destination": "Hanoi" }     |
      | "bus-3-vn" | { "destination": "Hang Mau" }  |
    And I "activate" the "plugin" pipe on "generic:document:beforeUpdate" with the following changes:
      | _source.leaveAt | "'10:30'"              |
      | _id             | "`${document._id}-vn`" |
    # mUpdate
    When I "update" the following multiple documents:
      | _id     | body                                               |
      | "bus-1" | { "destination": "Hà Giang", "company": "Cau Me" } |
      | "bus-2" | { "destination": "Sa Pa", "company": "So Viet" }   |
    Then The document "bus-1-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "10:30"    |
    Then The document "bus-2-vn" content match:
      | destination | "Sa Pa"   |
      | company     | "So Viet" |
      | leaveAt     | "10:30"   |
    # Change pipe modifications
    And I "activate" the "plugin" pipe on "generic:document:beforeUpdate" with the following changes:
      | _source.leaveAt | "'12:30'"              |
      | _id             | "`${document._id}-vn`" |
    # update
    When I "update" the document "bus-3" with content:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
    Then The document "bus-3-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "12:30"    |

  @mappings @events
  Scenario: Modify documents with document:generic:afterUpdate
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following multiple documents:
      | _id     | body                           |
      | "bus-1" | { "destination": "Ninh Binh" } |
      | "bus-2" | { "destination": "Hanoi" }     |
      | "bus-3" | { "destination": "Hang Mau" }  |
    And I "activate" the "plugin" pipe on "generic:document:afterUpdate" with the following changes:
      | _source.type | "'sleepingBus'"  |
      | _id          | "'confidential'" |
    # mUpdate
    When I "update" the following multiple documents:
      | _id     | body                  |
      | "bus-1" | { "duration": "12h" } |
      | "bus-2" | { "duration": "17h" } |
    Then I should receive a "successes" array of objects matching:
      | _id            | _source                                                                  |
      | "confidential" | { "destination": "Ninh Binh", "duration": "12h", "type": "sleepingBus" } |
      | "confidential" | { "destination": "Hanoi", "duration": "17h", "type": "sleepingBus" }     |
    # Change pipe modifications
    And I "activate" the "plugin" pipe on "generic:document:afterUpdate" with the following changes:
      | _source.type | "'localBus'" |
      | _id          | "'redacted'" |
    # update
    When I "update" the document "bus-3" with content:
      | duration | "14h" |
    Then I should receive a result matching:
      | _id     | "redacted"             |
      | _source | { "type": "localBus" } |

  @mappings @events
  Scenario: Upsert and modify documents with document:generic:beforeUpdate
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I "activate" the "plugin" pipe on "generic:document:beforeUpdate" with the following changes:
      | _source.leaveAt | "'10:30'"              |
      | _id             | "'bus-vn'" |
    When I successfully execute the action "document":"upsert" with args:
      | index      | "nyc-open-data"        |
      | collection | "yellow-taxi"          |
      | _id        | "foobar"               |
      | body       | { "changes": { "destination": "Ninh Binh" }, "default": { "company": "Cau Me" } } |
      | source     | true                   |
    Then The document "bus-vn" content match:
      | destination | "Ninh Binh" |
      | company     | "Cau Me"   |
      | leaveAt     | "10:30"    |
    # Change pipe modifications
    And I "activate" the "plugin" pipe on "generic:document:beforeUpdate" with the following changes:
      | _source.leaveAt | "'12:30'"              |
      | _id             | "'bus-vn'" |
    # update
    When I successfully execute the action "document":"upsert" with args:
      | index      | "nyc-open-data"        |
      | collection | "yellow-taxi"          |
      | _id        | "foobar"               |
      | body       | { "changes": { "destination": "Hà Giang" }, "default": { "company": "Oh Noes" } } |
      | source     | true                   |
    Then The document "bus-vn" content match:
      | destination | "Hà Giang" |
      | company     | "Cau Me"   |
      | leaveAt     | "12:30"    |

  @mappings @events
  Scenario: Upsert and modify documents with document:generic:afterUpdate
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I "activate" the "plugin" pipe on "generic:document:afterUpdate" with the following changes:
      | _source.type | "'sleepingBus'"  |
      | _id          | "'confidential'" |
    When I successfully execute the action "document":"upsert" with args:
      | index      | "nyc-open-data"        |
      | collection | "yellow-taxi"          |
      | _id        | "confidential"         |
      | body       | { "changes": { "destination": "Ninh Binh", "duration": "12h" }, "default": { "company": "Cau Me" } } |
      | source     | true                   |
    Then I should receive a result matching:
      | _id      | "confidential"                                                                  |
      | _source  | { "destination": "Ninh Binh", "duration": "12h", "type": "sleepingBus", "company": "Cau Me" } |
    # Change pipe modifications
    And I "activate" the "plugin" pipe on "generic:document:afterUpdate" with the following changes:
      | _source.type | "'localBus'" |
      | _id          | "'redacted'" |
    When I successfully execute the action "document":"upsert" with args:
      | index      | "nyc-open-data"        |
      | collection | "yellow-taxi"          |
      | _id        | "bus-travel"           |
      | body       | { "changes": { "destination": "Ninh Binh", "duration": "12h" }, "default": { "company": "Cau Me" } } |
      | source     | true                   |
    Then I should receive a result matching:
      | _id     | "redacted"             |
      | _source | { "type": "localBus" } |

  @mappings @events
  Scenario: Modify document with document:generic:beforeGet
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following multiple documents:
      | _id        | body                           |
      | "bus-1-vn" | { "destination": "Ninh Binh" } |
      | "bus-2-vn" | { "destination": "Hanoi" }     |
    And I "activate" the "plugin" pipe on "generic:document:beforeGet" with the following changes:
      | _id | "`${document._id}-vn`" |
    # mGet
    When I "mGet" the following document ids with verb "GET":
      | "bus-1" |
      | "bus-2" |
    Then I should receive a "successes" array of objects matching:
      | _id        | _source                        |
      | "bus-1-vn" | { "destination": "Ninh Binh" } |
      | "bus-2-vn" | { "destination": "Hanoi" }     |
    # get
    And The document "bus-1" content match:
      | destination | "Ninh Binh" |

  @mappings @events
  Scenario: Modify document with document:generic:afterGet
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following multiple documents:
      | _id     | body                           |
      | "bus-1" | { "destination": "Ninh Binh" } |
      | "bus-2" | { "destination": "Hanoi" }     |
    And I "activate" the "plugin" pipe on "generic:document:afterGet" with the following changes:
      | _source.type | "'sleepingBus'"  |
      | _id          | "'confidential'" |
    # mGet
    When I "mGet" the following document ids with verb "GET":
      | "bus-1" |
      | "bus-2" |
    Then I should receive a "successes" array of objects matching:
      | _id            | _source                                               |
      | "confidential" | { "destination": "Ninh Binh", "type": "sleepingBus" } |
      | "confidential" | { "destination": "Hanoi", "type": "sleepingBus" }     |
    # get
    And The document "bus-1" content match:
      | destination | "Ninh Binh"   |
      | type        | "sleepingBus" |

  @mappings @events
  Scenario: Modify document with document:generic:beforeDelete
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following multiple documents:
      | _id        | body                           |
      | "bus-1-vn" | { "destination": "Ninh Binh" } |
      | "bus-2-vn" | { "destination": "Hanoi" }     |
      | "bus-3-vn" | { "destination": "Hang Mau" }  |
    And I "activate" the "plugin" pipe on "generic:document:beforeDelete" with the following changes:
      | _id | "`${document._id}-vn`" |
    # mDelete
    When I "mDelete" the following document ids:
      | "bus-1" |
      | "bus-2" |
    Then The document "bus-1-vn" should not exist
    Then The document "bus-2-vn" should not exist
    # delete
    When I delete the document "bus-3"
    Then The document "bus-3-vn" should not exist

  @mappings @events
  Scenario: Modify document with document:generic:afterDelete
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "create" the following multiple documents:
      | _id     | body                           |
      | "bus-1" | { "destination": "Ninh Binh" } |
      | "bus-2" | { "destination": "Hanoi" }     |
      | "bus-3" | { "destination": "Hang Mau" }  |
    And I "activate" the "plugin" pipe on "generic:document:afterDelete" with the following changes:
      | _id | "'confidential'" |
    # mDelete
    When I "mDelete" the following document ids:
      | "bus-1" |
      | "bus-2" |
    Then The document "bus-1-vn" should not exist
    Then The document "bus-2-vn" should not exist
    Then I should receive a "successes" array matching:
      | "confidential" |
      | "confidential" |
    # delete
    When I delete the document "bus-3"
    Then I should receive a "string" result equals to "confidential"
    Then The document "bus-3-vn" should not exist

  # hooks ======================================================================

  @realtime
  Scenario: Listen to events with hooks
    Given I subscribe to "functional-test":"hooks" notifications
    When I successfully execute the action "server":"now"
    Then I should receive realtime notifications for "functional-test":"hooks" matching:
      | result._source.event |
      | "server:afterNow"    |

  # pipes declared with a function name

  @events
  Scenario: Trigger a pipe declared with a function name
    Given I "activate" the "plugin" pipe on "server:afterNow" without changes
    When I successfully execute the action "server":"now"
    Then I should receive a result matching:
      | lyrics | "_STRING_" |
