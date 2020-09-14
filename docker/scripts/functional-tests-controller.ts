import { Controller, Request } from '../../index';

export class FunctionalTestsController extends Controller {
  constructor (app) {
    super(app);

    this.definition = {
      actions: {
        helloWorld: {
          handler: this.helloWorld
        }
      }
    };
  }

  async helloWorld (request: Request) {
    return { greeting: `Hello, ${request.input.args.name}` };
  }
}
