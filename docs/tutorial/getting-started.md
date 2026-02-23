# Getting Started with C!

## What is C!?

C! (pronounced "C-Bang") is the first programming language designed for AI-human collaboration with security by construction. Its linear type system, actor-based concurrency, and intent annotations eliminate entire classes of vulnerabilities at compile time -- not through discipline, but through structural guarantees. C! compiles to native binaries, WebAssembly, and blockchain bytecode from a single codebase.

## Prerequisites

- **Node.js 22+** -- download from [nodejs.org](https://nodejs.org)
- **Git** -- download from [git-scm.com](https://git-scm.com)

## Installation

Clone the repository and build the compiler:

```bash
git clone https://github.com/integsec/C-Bang.git
cd C-Bang/compiler
npm install
npm run build
```

Verify the installation:

```bash
npx cbang --version
```

```
cbang 0.1.0
```

## Your first program

Create a file called `hello.cb`:

```
// hello.cb -- The classic "Hello, World!" in C!

#[intent("Print a greeting to standard output")]
fn main() {
    print("Hello from C!");
}
```

Let's walk through each line:

- `// hello.cb` -- A single-line comment. C! uses `//` for comments.
- `#[intent("Print a greeting to standard output")]` -- An **intent annotation**. This tells the compiler (and other AI agents) what the function is supposed to do. The compiler will eventually verify that the implementation matches the stated intent.
- `fn main()` -- Declares the program's entry point. `fn` is the keyword for defining functions.
- `print("Hello from C!")` -- Calls the built-in `print` function with a string literal.

## Using the CLI

### Check for errors

The `check` command runs the lexer, parser, and type checker on your file:

```bash
npx cbang check hello.cb
```

```
✓ Lexing passed (14 tokens)
✓ Parsing passed (1 top-level items)
```

This is the command you will use most often during development.

### See tokens (debug)

The `lex` command shows how the compiler breaks your source code into tokens:

```bash
npx cbang lex hello.cb
```

```
3:1      Annotation           #[intent("Print a greeting to standard o...
4:1      fn                   fn
4:4      Identifier           main
4:8      (                    (
4:9      )                    )
4:11     {                    {
5:5      Identifier           print
5:10     (                    (
5:11     StringLiteral        Hello from C!
5:26     )                    )
5:27     ;                    ;
6:1      }                    }
7:1      EOF

12 tokens, 0 errors
```

Each line shows `line:column`, the token type, and the token value. This is useful for debugging syntax issues.

### See the AST (debug)

The `parse` command shows the abstract syntax tree as JSON:

```bash
npx cbang parse hello.cb
```

```
{
  "kind": "Program",
  "items": [
    {
      "kind": "FunctionDecl",
      "name": "main",
      "annotations": [...],
      "params": [],
      "returnType": null,
      "body": {
        "kind": "Block",
        "statements": [
          {
            "kind": "ExprStmt",
            "expr": {
              "kind": "Call",
              "callee": { "kind": "Ident", "name": "print" },
              "args": [{ "kind": "StringLiteral", "value": "Hello from C!" }]
            }
          }
        ]
      }
    }
  ]
}

1 top-level items, 0 errors
```

## Language basics

Here is a brief tour of C! syntax and features. For the full design, see the [language design document](../plans/2026-02-22-c-bang-language-design.md).

### Variables

```
let x: i32 = 42;          // immutable, explicit type
let name = "Alice";        // immutable, type inferred
let mut counter = 0;       // mutable (must opt in)
```

### Functions

```
fn add(a: i32, b: i32) -> i32 {
    a + b
}

pure fn double(x: i32) -> i32 {
    x * 2
}
```

The `pure` keyword declares that a function has no side effects.

### Structs and types

```
struct Point {
    x: f64,
    y: f64,
}

type Result<T, E> = Ok(T) | Err(E);
type Port = u16{1..65535};          // refined type with value constraint
```

### Actors

C! uses the actor model for concurrency -- no threads, no locks, no data races:

```
actor Counter {
    state count: i64 = 0

    on Increment(by: i64) { count += by; }
    on GetCount() -> i64 { reply count; }
}
```

### Intent annotations

Intent annotations are C!'s key differentiator. They let AI agents communicate structured intent that the compiler verifies:

```
#[intent("Add two numbers without overflow")]
#[pre(a > 0, b > 0)]
fn safe_add(a: i32, b: i32) -> i32 {
    a + b
}
```

### Ownership

C! uses linear types to manage resources. Values are owned by default and ownership transfers on use:

```
let token = Token::mint(100);
transfer(token, alice);       // ownership moves to transfer()
// token is gone -- using it here is a compile error

fn display(user: &User) {    // borrowed: read-only access
    print(user.name);
}
```

## Next steps

- **Explore examples** -- browse the [`examples/`](../../examples/) directory for programs covering actors, web apps, and token contracts
- **Read the design** -- the full [language design document](../plans/2026-02-22-c-bang-language-design.md) covers the type system, concurrency model, and smart contract support in depth
- **Contribute** -- see the [contributing guide](../../CONTRIBUTING.md) for how to get involved
- **Check the roadmap** -- open [GitHub Issues](https://github.com/integsec/C-Bang/issues) to see what is being built and find tasks to pick up

## Getting help

- **GitHub Issues** -- [report bugs or request features](https://github.com/integsec/C-Bang/issues)
- **GitHub Discussions** -- ask questions and share ideas on the [C-Bang Discussions](https://github.com/integsec/C-Bang/discussions) page
- **Website** -- [c-bang.integsec.com](https://c-bang.integsec.com) for documentation and community links
