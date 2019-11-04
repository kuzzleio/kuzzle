Feature: Plugin context

  # constructors.ESClient ======================================================

  @mappings
  Scenario: Instantiate a new embedded ES Client and use it
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I successfully call the route "functional-test-plugin/constructors":"ESClient" with args:
    | _id | "es-document" |
    | body | { "from": "embedded-es-client" } |
    | index | "&nyc-open-data.yellow-taxi" |
    Then The document "es-document" content matches:
    | from | "embedded-es-client" |
