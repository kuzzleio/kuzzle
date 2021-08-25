import { Controller, Request } from '../../index';

export class FunctionalTestsController extends Controller {
  constructor (app) {
    super(app);

    this.definition = {
      actions: {
        helloWorld: {
          handler: this.helloWorld,
          openapi: {
            "/_/greeting/hello-world/{name}": {
              get: {
                parameters: [{
                  in: "path",
                  name: "name",
                  schema: {
                    type: "string"
                  },
                  required: true,
                }],
                responses: {
                  200: {
                    description: "Custom greeting",
                    content: {
                      "application/json": {
                        schema: {
                          type: "string",
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        byeWorld: {
          handler: this.byeWorld
        }
      }
    };
  }

  async helloWorld (request: Request) {
    return { greeting: `Hello, ${request.input.args.name}` };
  }

  async byeWorld () {
    // ensure the "app" property is usable
    return this.app.sdk.document.create('test', 'test', { message: 'bye' });
  }
}
