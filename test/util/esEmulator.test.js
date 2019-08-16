'use strict';

const {
  getESIndex,
  extractIndex,
  extractCollection,
  extractIndexes,
  extractCollections
} = require('../../lib/util/esEmulator');

describe('Elasticsearch collection emulator utils', () => {

  describe('#getESIndex', () => {
    it('return esIndex name for a collection', () => {
      const
        userESIndex = getESIndex('nepali', 'liia'),
        internalESIndex = getESIndex('nepali', 'mehry', { internal: true });

      should(userESIndex).be.eql('#nepali/liia');
      should(internalESIndex).be.eql('%nepali/mehry');
    });
  });

  describe('#extractIndex', () => {
    it('extract the index name from esIndex name', () => {
      should(extractIndex('#nepali/liia')).be.eql('nepali')
      should(extractIndex('%nepali/mehry')).be.eql('nepali')
    });
  });

  describe('#extractCollection', () => {
    it('extract the collection names from esIndex name', () => {
      should(extractCollection('#nepali/liia')).be.eql('liia')
      should(extractCollection('%nepali/mehry')).be.eql('mehry')
    });
  });

  describe('#extractIndexes', () => {
    it('extract the index names from a list of esIndex name', () => {
      const esIndexes = [
        '%nepali/liia', '%nepali/mehry', '#india/darjeeling', '#vietnam/lfiduras'];

      should(extractIndexes(esIndexes)).be.eql(['india', 'vietnam']);

      should(extractIndexes(esIndexes, { internal: true })).be.eql(['nepali']);
    });
  });

  describe('#extractCollections', () => {
    it('extract the collection names for an index from a list of esIndex name', () => {
      const esIndexes = [
        '%nepali/liia', '%nepali/mehry', '#nepali/panipokari', '#vietnam/lfiduras'];

      should(extractCollections(esIndexes, 'nepali')).be.eql(['panipokari']);

      should(extractCollections(esIndexes, 'nepali', { internal: true }))
        .be.eql(['liia', 'mehry']);
    });
  });


});
