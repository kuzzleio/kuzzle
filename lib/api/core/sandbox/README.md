# Sandbox

This module allows to run some untrusted code to validate its output.  
It is largely inspired by [Jailed](https://github.com/asvd/jailed).

## How to use

```javascript
var
  Sandbox = require('Sandbox'),
  sandbox = new Sandbox({timeout: 1000});

sandbox.run({
  sandbox: {
    a: 1
  },
  code: '(function(){ a++; return a; })()'
})
  .then(data => {
    console.log(data);
  });

// displays
// { result: 2, context: { a: 2 }}
```

### Constructor

The Sandbox constructor can be given an optional options object.  
Available options:

* timeout: The timeout in ms after which the child process is killed if no answer is given back. Defaults to 500ms.

### run methods

#### Parameters

The object passed to the run methods accepts the following attributes:

* _sandbox_: (optional). The context to pass to the executed code. Its properties will be exposed as some global variables for the sandboxed code. Defaults to an empty object.
* _code_: (mandatory). The code to execute expressed as a string.

#### Return value

Returns a _Promise_.

## How it works

1. A new node.js child process is forked.
2. The given context and code are passed to the child process.
3. The child process executes the code using [node.js vm module](https://nodejs.org/api/vm.html)

:warning: *NB: Creating a node child process is an expensive operation. From [node.js documentation](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options):*

    These child Node.js processes are still whole new instances of V8.
    Assume at least 30ms startup and 10mb memory for each new Node.js.
    That is, you cannot create many thousands of them.
