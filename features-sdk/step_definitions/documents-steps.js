const
  _ = require('lodash'),
  should = require('should'),
  {
    Given,
    Then
  } = require('cucumber');

Given('I create the following document:', async function (dataTable) {
  const document = this.parseDataTable(dataTable);

  const
    index = document.index || this.props.index,
    collection = document.collection || this.props.collection;

  this.props.result = await this.sdk.document.create(
    index,
    collection,
    document.body,
    document.id);

  this.props.documentId = this.props.result._id;
});

Then('The document {string} content match:', async function (documentId, dataTable) {
  const expectedContent = this.parseDataTable(dataTable);

  const document = await this.sdk.document.get(
    this.props.index,
    this.props.collection,
    documentId);

  should(document._source).match(expectedContent);
});
