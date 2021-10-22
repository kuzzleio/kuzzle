# This file must be tested before any other feature, right after starting Kuzzle
# Cucumber execute features by alphabetical order, hence the '#' in the filename

Feature: Backend Import

  # import:mappings ===========================================================

  @preserveDatabase
  Scenario: Check if mappings have been correctly imported
    Given I have configured mappings in the app before startup
    When I successfully execute the action "collection":"getMapping" with args:
      | index             | 'index1'      |
      | collection        | 'collection1' |
      | includeKuzzleMeta | true          |
    Then I should receive a result matching:
      | dynamic    | 'strict'                                                   |
      | _meta      | { field: 'value' }                                         |
      | properties | { fieldA: { type: 'keyword'}, fieldB: { type: 'integer'} } |
    When I successfully execute the action "collection":"getMapping" with args:
      | index      | 'index1'      |
      | collection | 'collection2' |
    Then I should receive a result matching:
      | properties | { fieldC: { type: 'keyword'} } |
    When I successfully execute the action "collection":"getMapping" with args:
      | index      | 'index2'      |
      | collection | 'collection1' |
    Then I should receive a result matching:
      | properties | { fieldD: { type: 'integer'} } |

  # import:profiles ===========================================================

  @preserveDatabase
  Scenario: Check if profiles have been correctly imported
    Given I have imported profiles in the app before startup
    Then The profile "profileA" policies should match:
      | roleId  | restrictedTo                                                      |
      | "roleB" | { index: 'index1', collections: [ 'collection1', 'collection2'] } |
    And The profile "profileB" policies should match:
      | roleId  |
      | "roleA" |

  # import:roles ==============================================================

  @preserveDatabase
  Scenario: Check if roles have been correctly imported
    Given I have imported roles in the app before startup
    Then The role "roleA" should match:
      | document | { create: true, get: true } |
      | cluster  | { "*": true }               |
    And The role "roleB" should match:
      | * | { "*": true } |

  # import:userMappings =======================================================

  @preserveDatabase
  Scenario: Check if user mappings have been correctly imported
    Given I have configured user mappings in the app before startup
    When I successfully execute the action "security":"getUserMapping"
    Then The property "mapping" of the result should match:
      | age | { type: 'long' } |

  # import:users ==============================================================

  @preserveDatabase @login
  Scenario: Check if users have been correctly imported
    Given I have imported users in the app before startup
    When I successfully execute the action "security":"mGetUsers" with args:
      | body | { ids: [ 'userA', 'userB' ] } |
    Then I should receive a "hits" array of objects matching:
      | _id     | _source                                           |
      | "userA" | { profileIds: ['profileA', 'profileB'], age: 42 } |
      | "userB" | { profileIds: ['profileA'], age: 5 }              |
    And I'm logged in Kuzzle as user "bar" with password "foobar"