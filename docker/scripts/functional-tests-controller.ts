import { Controller, Request } from '../../index';

export class FunctionalTestsController extends Controller {
  constructor (app) {
    super(app);

    this.definition = {
      actions: {
        helloWorld: {
          handler: this.helloWorld
        },
        byeWorld: {
          handler: this.byeWorld
        },
        postHelloWorld: {
          handler: this.postHelloWorld,
          http: [{path: 'functional-tests/hello-world', verb: 'post'}]
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

  async postHelloWorld (request: Request) {
    return { greeting: `Hello, ${request.getBodyString("name")}` };
  }
}
