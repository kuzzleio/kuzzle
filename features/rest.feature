Feature: Test REST API
  As a user
  I want to create/update/delete/search a document and test bulk import
  From REST HTTP

  @needCleanDb
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @needCleanDb
  Scenario: Update a document
    When I write the document
    Then I update the document with value "toto" in field "firstName"
    Then my document has the value "toto" in field "firstName"

  @needCleanDb
  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  @needCleanDb
  Scenario: Search a document
    When I write the document "documentGrace"
    Then I find a document with "grace" in field "firstName"

  @needCleanDb
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @needCleanDb
  Scenario: Delete type
    When I write the document
    Then I remove the collection and schema
    Then I'm not able to get the document

  @needCleanDb @removeSchema
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I remove the collection and schema
    Then I wait 2s
    Then I change the schema
    When I write the document "documentGrace"
    Then I find a document with "Grace" in field "firstName"