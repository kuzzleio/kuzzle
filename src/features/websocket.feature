Feature: Test websocket API
  As a user
  I want to create/update/delete/search a document and test bulk import
  From websocket

  @needCleanDb @withWebsocket
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @needCleanDb @withWebsocket
  Scenario: Update a document
    When I write the document
    Then I update the document with value "toto" in field "firstName"
    Then my document has the value "toto" in field "firstName"

  @needCleanDb @withWebsocket
  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  @needCleanDb @withWebsocket
  Scenario: Search a document
    When I write the document "documentGrace"
    Then I found a document with "grace" in field "firstName"

  @needCleanDb @withWebsocket
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @needCleanDb @withWebsocket
  Scenario: Delete type
    When I write the document
    Then I remove the collection
    Then I'm not able to get the document