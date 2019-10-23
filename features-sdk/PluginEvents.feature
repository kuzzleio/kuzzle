Feature: Plugin Events

  @mappings @events
  Scenario: Modify documents with document:generic:beforeWrite
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "activate" the pipe on "generic:document:beforeWrite" with the following changes:
    | _source.leaveAt | "'10:30'" |
    | _id | "`${document._id}-vn`" |
    # mCreate
    When I "create" the following documents:
    | _id     | body  |
    | "bus-1" | { "destination": "Hà Giang", "company": "Cau Me" } |
    | "bus-2" | { "destination": "Sa Pa", "company": "So Viet" } |
    Then The document "bus-1-vn" content match:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    | leaveAt | "10:30" |
    Then The document "bus-2-vn" content match:
    | destination | "Sa Pa" |
    | company | "So Viet" |
    | leaveAt | "10:30" |
    # mCreateOrReplace
    When I "createOrReplace" the following documents:
    | _id     | body  |
    | "bus-3" | { "destination": "Hà Giang", "company": "Cau Me" } |
    | "bus-4" | { "destination": "Sa Pa", "company": "So Viet" } |
    Then The document "bus-3-vn" content match:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    | leaveAt | "10:30" |
    Then The document "bus-4-vn" content match:
    | destination | "Sa Pa" |
    | company | "So Viet" |
    | leaveAt | "10:30" |
    # Change pipe modifications
    And I "activate" the pipe on "generic:document:beforeWrite" with the following changes:
    | _source.leaveAt | "'11:30'" |
    | _id | "`${document._id}-vn`" |
    # mReplace
    When I "replace" the following documents:
    | _id     | body  |
    | "bus-1" | { "destination": "Hà Giang", "company": "Cau Me" } |
    | "bus-2" | { "destination": "Sa Pa", "company": "So Viet" } |
    Then The document "bus-1-vn" content match:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    | leaveAt | "11:30" |
    Then The document "bus-2-vn" content match:
    | destination | "Sa Pa" |
    | company | "So Viet" |
    | leaveAt | "11:30" |
    # # mUpdate
    # When I "update" the following documents:
    # | _id     | body  |
    # | "bus-3" | { "destination": "Hà Giang", "company": "Cau Me" } |
    # | "bus-4" | { "destination": "Sa Pa", "company": "So Viet" } |
    # Then The document "bus-3-vn" content match:
    # | destination | "Hà Giang" |
    # | company | "Cau Me" |
    # | leaveAt | "11:30" |
    # Then The document "bus-4-vn" content match:
    # | destination | "Sa Pa" |
    # | company | "So Viet" |
    # | leaveAt | "11:30" |
    # create
    When I "create" the document "bus-5" with content:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    Then The document "bus-5-vn" content match:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    | leaveAt | "11:30" |
    # createOrReplace
    When I "createOrReplace" the document "bus-6" with content:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    Then The document "bus-6-vn" content match:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    | leaveAt | "11:30" |
    And I "activate" the pipe on "generic:document:beforeWrite" with the following changes:
    | _source.leaveAt | "'12:30'" |
    | _id | "`${document._id}-vn`" |
    # replace
    When I "replace" the document "bus-5" with content:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    Then The document "bus-5-vn" content match:
    | destination | "Hà Giang" |
    | company | "Cau Me" |
    | leaveAt | "12:30" |
    # update
    # When I "update" the document "bus-6" with content:
    # | destination | "Hà Giang" |
    # | company | "Cau Me" |
    # Then The document "bus-6-vn" content match:
    # | destination | "Hà Giang" |
    # | company | "Cau Me" |
    # | leaveAt | "12:30" |

  @mappings @events
  Scenario: Modify documents with document:generic:afterWrite
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I "activate" the pipe on "generic:document:afterWrite" with the following changes:
    | _source.type | "'sleepingBus'" |
    | _id | "'confidential'" |
    # mCreate
    When I "create" the following documents:
    | _id     | body  |
    | "bus-1" | { "duration": "6h" } |
    | "bus-2" | { "duration": "8h30" } |
    Then I should receive a "successes" array of objects matching:
    | _id | _source |
    | "confidential" | { "duration": "6h", "type": "sleepingBus" } |
    | "confidential" | { "duration": "8h30", "type": "sleepingBus" } |
    # mCreateOrReplace
    When I "createOrReplace" the following documents:
    | _id     | body  |
    | "bus-3" | { "duration": "6h" } |
    | "bus-4" | { "duration": "8h30" } |
    Then I should receive a "successes" array of objects matching:
    | _id | _source |
    | "confidential" | { "duration": "6h", "type": "sleepingBus" } |
    | "confidential" | { "duration": "8h30", "type": "sleepingBus" } |
    # create
    When I "create" the document "bus-5" with content:
    | duration | "6h" |
    Then I should receive a result matching:
    | _id | "confidential" |
    | _source | { "duration": "6h", "type": "sleepingBus" } |
    # createOrReplace
    When I "createOrReplace" the document "bus-6" with content:
    | duration | "6h" |
    Then I should receive a result matching:
    | _id | "confidential" |
    | _source | { "duration": "6h", "type": "sleepingBus" } |
    # Change pipe modifications
    And I "activate" the pipe on "generic:document:afterWrite" with the following changes:
    | _source.type | "'localBus'" |
    | _id | "'redacted'" |
    # mReplace
    When I "replace" the following documents:
    | _id     | body  |
    | "bus-1" | { "duration": "12h" } |
    | "bus-2" | { "duration": "17h" } |
    Then I should receive a "successes" array of objects matching:
    | _id | _source |
    | "redacted" | { "duration": "12h", "type": "localBus" } |
    | "redacted" | { "duration": "17h", "type": "localBus" } |
    # replace
    When I "replace" the document "bus-5" with content:
    | duration | "12h" |
    Then I should receive a result matching:
    | _id | "redacted" |
    | _source | { "duration": "12h", "type": "localBus" } |
