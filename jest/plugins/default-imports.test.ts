import { useSdk } from "../helpers/useSdk";

describe("Default loading of plugin's imports", () => {
  const sdk = useSdk();

  beforeAll(async () => {
    await sdk.connect();
  });

  afterAll(async () => {
    sdk.disconnect();
  });

  it("shoud load roles and collections", async () => {
    const role = await sdk.security.getRole('imported-role');

    expect(role.controllers).toMatchObject({
      auth: {
        actions: {
          login: true,
        }
      }
    });

    const collection = await sdk.collection.getMapping('imported-index', 'imported-collection');

    expect(collection.properties).toMatchObject({
      name: { type: 'keyword' }
    });
  });
});

