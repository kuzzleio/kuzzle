type StepCallback = () => void;

type StepApi = Record<string, (...args: any[]) => Promise<any>>;

type StepContext = {
  api: StepApi;
  result?: any;
};

function getReturn(
  this: StepContext,
  action: string,
  ...args: [...any[], StepCallback]
): void {
  const callback = args.pop() as StepCallback;

  this.api[action](...args)
    .then((response) => {
      this.result = response;
      callback();
    })
    .catch((error) => {
      this.result = error;
      callback();
    });
}

export default {
  getReturn,
};
