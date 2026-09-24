import net from "net";
import fs from "fs";
import path from "path";

import { When, Then } from "@cucumber/cucumber";
import { httpApi } from "../support/stepUtils";
import type KWorld from "../support/world";

When("I send the crafted HTTP multipart request", function (done) {
  const socket = net.createConnection(7512, undefined, () => {
    const rq = fs.readFileSync("./features-legacy/fixtures/bad-multipart.req");

    socket.write(rq.toString(), (error) => {
      socket.end();
      done(error);
    });
  });

  socket.on("error", done);
});

Then("Kuzzle is still up", async function (this: KWorld) {
  await this.api.serverPublicApi();
});

When(
  "I create a document using an URL encoded form",
  async function (this: KWorld) {
    const response = await httpApi(this).urlEncodedCreate({
      firstName: "Grace",
      lastName: "Hopper",
    });

    if (response.error) {
      throw new Error(
        `Failed to create document: ${JSON.stringify(response.error)}`,
      );
    }

    this.result = response.result;
  },
);

When(
  "I create a document using a multipart form",
  async function (this: KWorld) {
    const multipartContent = path.normalize(
      `${__dirname}/../fixtures/multipart_content`,
    );

    const response = await httpApi(this).multipartCreate({
      attachments: [fs.createReadStream(multipartContent)],
      firstName: "Grace",
      lastName: "Hopper",
    });

    if (response.error) {
      throw new Error(
        `Failed to create document: ${JSON.stringify(response.error)}`,
      );
    }

    this.result = response.result;
  },
);

Then(
  "The multipart document was correctly created",
  async function (this: KWorld) {
    const source = fs.readFileSync(
      `${__dirname}/../fixtures/multipart_content`,
      "base64",
    );

    const response = await this.api.get(this.result._id);
    const document = response.result._source;

    if (!document.attachments || !document.attachments.file) {
      throw new Error("Created document does not contain the file attachment");
    }

    if (document.attachments.file !== source) {
      throw new Error("Malformed attachment content");
    }
  },
);
