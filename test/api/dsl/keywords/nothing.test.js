const
  should = require('should'),
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.nothing', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should register in the store', () => {
      return dsl.register('index', 'collection', {nothing: 'anything'})
        .then(subscription => {
          const storeEntry = dsl.storage.foPairs.index.collection.nothing;

          should(storeEntry)
            .be.instanceof(FieldOperand);
          should(storeEntry.fields.all)
            .eql([dsl.storage.filters[subscription.id].subfilters[0]]);
        });
    });
  });
});
