# Codegen Completion, Standard Library & Playground Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete JS codegen for all declaration types (server, component, contract), expand test coverage, add a standard library foundation, improve CLI, and build a browser playground.

**Architecture:** Extend the existing `JsGenerator` class with real implementations for server/component/contract declarations (currently stubs). Add a `stdlib/` directory with core module definitions. Build a static HTML playground that bundles the compiler for in-browser use.

**Tech Stack:** TypeScript (compiler), Vitest (tests), HTML/CSS/JS (playground), esbuild (bundling)

---

### Task 1: Server Declaration JS Code Generation

**Files:**
- Modify: `compiler/src/codegen/jsgen.ts` (line 239-241, `emitServerDecl`)
- Modify: `compiler/tests/codegen.test.ts` (add tests after line 567)

**Step 1: Write failing tests**

Add to `codegen.test.ts` after the stub declarations describe block:

```typescript
describe('server declarations', () => {
  it('generates server class with route methods', () => {
    const js = generate(`
      server Api {
        fn handle() {}
      }
    `);
    expect(js).toContain('class Api {');
    expect(js).toContain('handle() {');
  });

  it('generates server with state fields in constructor', () => {
    const js = generate(`
      server App {
        state port: i32 = 8080
        fn start() {}
      }
    `);
    expect(js).toContain('class App {');
    expect(js).toContain('constructor() {');
    expect(js).toContain('this.port = 8080;');
    expect(js).toContain('start() {');
  });

  it('generates server with field assignments as properties', () => {
    const js = generate(`
      server Api {
        bind: "0.0.0.0:8080"
        fn handle() {}
      }
    `);
    expect(js).toContain('class Api {');
    expect(js).toContain('this.bind = "0.0.0.0:8080";');
  });

  it('generates public server with export', () => {
    const js = generate(`
      pub server Api {
        fn handle() {}
      }
    `);
    expect(js).toContain('export class Api {');
  });

  it('generates server with annotations as comments', () => {
    const js = generate(`
      #[intent(serve HTTP requests)]
      server Api {
        fn handle() {}
      }
    `);
    expect(js).toContain('/* @intent(serve HTTP requests) */');
    expect(js).toContain('class Api {');
  });

  it('generates server with annotated route methods', () => {
    const js = generate(`
      server Api {
        #[get("/users")]
        fn get_users() {
          let x = 1;
        }
      }
    `);
    expect(js).toContain('/* #[get("/users")] */');
    expect(js).toContain('get_users() {');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd compiler && npx vitest run tests/codegen.test.ts`
Expected: FAIL — tests expect class generation but get `/* server Api not yet supported */`

**Step 3: Implement server codegen**

Replace `emitServerDecl` in `jsgen.ts`:

```typescript
private emitServerDecl(decl: ServerDecl): void {
  this.emitAnnotationsAsComments(decl.annotations);
  const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

  const stateMembers = decl.members.filter(m => m.kind === 'StateDecl') as StateDecl[];
  const fieldAssigns = decl.members.filter(m => m.kind === 'FieldAssignment') as import('../ast/index.js').FieldAssignment[];
  const functions = decl.members.filter(m => m.kind === 'FunctionDecl') as FunctionDecl[];

  this.writeLine(`${exportPrefix}class ${decl.name} {`);
  this.indentInc();

  // Constructor for state and field assignments
  if (stateMembers.length > 0 || fieldAssigns.length > 0) {
    this.writeLine('constructor() {');
    this.indentInc();
    for (const s of stateMembers) {
      if (s.initializer) {
        this.writeLine(`this.${s.name} = ${this.exprToString(s.initializer)};`);
      } else {
        this.writeLine(`this.${s.name} = undefined;`);
      }
    }
    for (const f of fieldAssigns) {
      this.writeLine(`this.${f.name} = ${this.exprToString(f.value)};`);
    }
    this.indentDec();
    this.writeLine('}');
  }

  // Route methods
  for (const fn of functions) {
    this.writeLine('');
    this.emitAnnotationsAsComments(fn.annotations);
    const asyncPrefix = fn.isAsync ? 'async ' : '';
    const params = fn.params.map(p => p.name).join(', ');
    this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
    this.emitBlockBody(fn.body);
    this.writeLine('}');
  }

  this.indentDec();
  this.writeLine('}');
}
```

**Step 4: Run tests to verify they pass**

Run: `cd compiler && npx vitest run tests/codegen.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add compiler/src/codegen/jsgen.ts compiler/tests/codegen.test.ts
git commit -m "feat(codegen): implement server declaration JS code generation"
```

---

### Task 2: Component Declaration JS Code Generation

**Files:**
- Modify: `compiler/src/codegen/jsgen.ts` (line 247-249, `emitComponentDecl`)
- Modify: `compiler/tests/codegen.test.ts`

**Step 1: Write failing tests**

```typescript
describe('component declarations', () => {
  it('generates component as a function', () => {
    const js = generate(`
      component Greeting(name: String) {
        let msg = name;
      }
    `);
    expect(js).toContain('function Greeting(name) {');
    expect(js).toContain('const msg = name;');
  });

  it('generates component with no params', () => {
    const js = generate(`
      component Header() {
        let title = "Hello";
      }
    `);
    expect(js).toContain('function Header() {');
  });

  it('generates public component with export', () => {
    const js = generate(`
      pub component Button(label: String) {
        let x = label;
      }
    `);
    expect(js).toContain('export function Button(label) {');
  });

  it('generates component with annotations', () => {
    const js = generate(`
      #[intent(render user profile)]
      component Profile(user: User) {
        let name = user;
      }
    `);
    expect(js).toContain('/* @intent(render user profile) */');
    expect(js).toContain('function Profile(user) {');
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement component codegen**

Replace `emitComponentDecl`:

```typescript
private emitComponentDecl(decl: ComponentDecl): void {
  this.emitAnnotationsAsComments(decl.annotations);
  const exportPrefix = decl.visibility === 'public' ? 'export ' : '';
  const params = decl.params.map(p => p.name).join(', ');
  this.writeLine(`${exportPrefix}function ${decl.name}(${params}) {`);
  this.emitBlockBody(decl.body);
  this.writeLine('}');
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add compiler/src/codegen/jsgen.ts compiler/tests/codegen.test.ts
git commit -m "feat(codegen): implement component declaration JS code generation"
```

---

### Task 3: Contract Declaration JS Code Generation

**Files:**
- Modify: `compiler/src/codegen/jsgen.ts` (line 239-241, `emitContractDecl`)
- Modify: `compiler/tests/codegen.test.ts`

**Step 1: Write failing tests**

```typescript
describe('contract declarations', () => {
  it('generates contract as a class with state', () => {
    const js = generate(`
      contract Token {
        state supply: u256 = 0
      }
    `);
    expect(js).toContain('class Token {');
    expect(js).toContain('constructor() {');
    expect(js).toContain('this.supply = 0;');
  });

  it('generates contract with init as constructor', () => {
    const js = generate(`
      contract Token {
        state owner: Address

        init() {
          owner = caller;
        }
      }
    `);
    expect(js).toContain('class Token {');
    expect(js).toContain('constructor() {');
    expect(js).toContain('this.owner = undefined;');
    expect(js).toContain('owner = caller;');
  });

  it('generates contract functions as methods', () => {
    const js = generate(`
      contract Token {
        state supply: u256 = 0

        pub fn mint(amount: u256) {
          supply += amount;
        }
      }
    `);
    expect(js).toContain('mint(amount) {');
    expect(js).toContain('supply += amount;');
  });

  it('generates public contract with export', () => {
    const js = generate(`
      pub contract Registry {
        state count: u256 = 0
      }
    `);
    expect(js).toContain('export class Registry {');
  });

  it('generates contract with annotations', () => {
    const js = generate(`
      #[intent(manage token supply)]
      contract Token {
        state supply: u256 = 0
      }
    `);
    expect(js).toContain('/* @intent(manage token supply) */');
    expect(js).toContain('class Token {');
  });

  it('generates contract with interfaces as comment', () => {
    const js = generate(`
      contract Token {
        state supply: u256 = 0
      }
    `);
    expect(js).toContain('class Token {');
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement contract codegen**

Replace `emitContractDecl`:

```typescript
private emitContractDecl(decl: ContractDecl): void {
  this.emitAnnotationsAsComments(decl.annotations);
  const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

  const stateMembers = decl.members.filter(m => m.kind === 'StateDecl') as StateDecl[];
  const functions = decl.members.filter(m => m.kind === 'FunctionDecl') as FunctionDecl[];
  const initDecl = decl.members.find(m => m.kind === 'InitDecl') as import('../ast/index.js').InitDecl | undefined;

  if (decl.interfaces.length > 0) {
    this.writeLine(`/* implements ${decl.interfaces.join(', ')} */`);
  }

  this.writeLine(`${exportPrefix}class ${decl.name} {`);
  this.indentInc();

  // Constructor — state + init
  if (stateMembers.length > 0 || initDecl) {
    const initParams = initDecl ? initDecl.params.map(p => p.name).join(', ') : '';
    this.writeLine(`constructor(${initParams}) {`);
    this.indentInc();
    for (const s of stateMembers) {
      if (s.initializer) {
        this.writeLine(`this.${s.name} = ${this.exprToString(s.initializer)};`);
      } else {
        this.writeLine(`this.${s.name} = undefined;`);
      }
    }
    if (initDecl) {
      for (const stmt of initDecl.body.statements) {
        this.emitStmt(stmt);
      }
    }
    this.indentDec();
    this.writeLine('}');
  }

  // Functions → methods
  for (const fn of functions) {
    this.writeLine('');
    this.emitAnnotationsAsComments(fn.annotations);
    const asyncPrefix = fn.isAsync ? 'async ' : '';
    const params = fn.params.map(p => p.name).join(', ');
    this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
    this.emitBlockBody(fn.body);
    this.writeLine('}');
  }

  this.indentDec();
  this.writeLine('}');
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add compiler/src/codegen/jsgen.ts compiler/tests/codegen.test.ts
git commit -m "feat(codegen): implement contract declaration JS code generation"
```

---

### Task 4: Expand Codegen Test Coverage

**Files:**
- Modify: `compiler/tests/codegen.test.ts`

Add tests for edge cases not yet covered:

```typescript
describe('match expressions', () => {
  it('generates match expression as IIFE', () => {
    const js = generate(`
      fn main() {
        let result = match x {
          1 => "one",
          _ => "other",
        };
      }
    `);
    expect(js).toContain('(() => {');
    expect(js).toContain('__match');
  });
});

describe('if expressions', () => {
  it('generates ternary from if expression', () => {
    const js = generate(`
      fn main() {
        let x = if true { 1 } else { 2 };
      }
    `);
    expect(js).toContain('true ? 1 : 2');
  });
});

describe('block expressions', () => {
  it('generates IIFE from block expression', () => {
    const js = generate(`
      fn main() {
        let x = { let y = 1; return y; };
      }
    `);
    expect(js).toContain('(() => {');
  });
});

describe('use declarations', () => {
  it('generates use as comment', () => {
    const js = generate(`
      use std::io::println
      fn main() {}
    `);
    expect(js).toContain('/* use std/io::println */');
  });
});

describe('emit and spawn statements', () => {
  it('generates emit as comment', () => {
    const js = generate(`
      actor Counter {
        state count: i32 = 0
        on Increment() {
          count += 1;
          emit CountChanged(count);
        }
      }
    `);
    expect(js).toContain('/* emit CountChanged(count) */');
  });
});

describe('reply statements', () => {
  it('generates reply as return', () => {
    const js = generate(`
      actor Calc {
        state result: i32 = 0
        on Add(n: i32) {
          reply n;
        }
      }
    `);
    expect(js).toContain('return n;');
  });
});
```

Run all tests, commit:
```bash
git add compiler/tests/codegen.test.ts
git commit -m "test(codegen): add coverage for match/if/block expressions, use, emit, reply"
```

---

### Task 5: Standard Library Foundation

**Files:**
- Create: `compiler/src/stdlib/index.ts`
- Create: `compiler/src/stdlib/io.ts`
- Create: `compiler/src/stdlib/math.ts`
- Create: `compiler/src/stdlib/collections.ts`
- Create: `compiler/src/stdlib/string.ts`
- Create: `compiler/tests/stdlib.test.ts`
- Modify: `compiler/src/index.ts` (re-export stdlib)

**Step 1: Create stdlib module definitions**

`compiler/src/stdlib/io.ts`:
```typescript
/** Standard I/O module — runtime function signatures for the C! standard library. */
export const IO_MODULE = {
  name: 'io',
  functions: [
    { name: 'print', params: ['value: String'], returnType: 'void', jsImpl: 'console.log' },
    { name: 'println', params: ['value: String'], returnType: 'void', jsImpl: 'console.log' },
    { name: 'eprint', params: ['value: String'], returnType: 'void', jsImpl: 'console.error' },
    { name: 'eprintln', params: ['value: String'], returnType: 'void', jsImpl: 'console.error' },
    { name: 'read_line', params: [], returnType: 'String', jsImpl: '(() => prompt(""))' },
  ],
} as const;
```

`compiler/src/stdlib/math.ts`:
```typescript
/** Math module — numeric utilities. */
export const MATH_MODULE = {
  name: 'math',
  functions: [
    { name: 'abs', params: ['x: f64'], returnType: 'f64', jsImpl: 'Math.abs' },
    { name: 'sqrt', params: ['x: f64'], returnType: 'f64', jsImpl: 'Math.sqrt' },
    { name: 'floor', params: ['x: f64'], returnType: 'i64', jsImpl: 'Math.floor' },
    { name: 'ceil', params: ['x: f64'], returnType: 'i64', jsImpl: 'Math.ceil' },
    { name: 'round', params: ['x: f64'], returnType: 'i64', jsImpl: 'Math.round' },
    { name: 'min', params: ['a: f64', 'b: f64'], returnType: 'f64', jsImpl: 'Math.min' },
    { name: 'max', params: ['a: f64', 'b: f64'], returnType: 'f64', jsImpl: 'Math.max' },
    { name: 'pow', params: ['base: f64', 'exp: f64'], returnType: 'f64', jsImpl: 'Math.pow' },
    { name: 'random', params: [], returnType: 'f64', jsImpl: 'Math.random' },
  ],
  constants: [
    { name: 'PI', type: 'f64', jsImpl: 'Math.PI' },
    { name: 'E', type: 'f64', jsImpl: 'Math.E' },
    { name: 'INFINITY', type: 'f64', jsImpl: 'Infinity' },
  ],
} as const;
```

`compiler/src/stdlib/collections.ts`:
```typescript
/** Collections module — methods available on built-in collection types. */
export const COLLECTIONS_MODULE = {
  name: 'collections',
  types: [
    {
      name: 'Vec',
      methods: [
        { name: 'push', params: ['item: T'], returnType: 'void', jsImpl: '.push' },
        { name: 'pop', params: [], returnType: 'Option<T>', jsImpl: '.pop' },
        { name: 'len', params: [], returnType: 'usize', jsImpl: '.length' },
        { name: 'is_empty', params: [], returnType: 'bool', jsImpl: '((v) => v.length === 0)' },
        { name: 'contains', params: ['item: &T'], returnType: 'bool', jsImpl: '.includes' },
        { name: 'iter', params: [], returnType: 'Iterator<T>', jsImpl: '.values' },
        { name: 'map', params: ['f: fn(T) -> U'], returnType: 'Vec<U>', jsImpl: '.map' },
        { name: 'filter', params: ['f: fn(&T) -> bool'], returnType: 'Vec<T>', jsImpl: '.filter' },
      ],
    },
    {
      name: 'Map',
      methods: [
        { name: 'get', params: ['key: K'], returnType: 'Option<V>', jsImpl: '.get' },
        { name: 'set', params: ['key: K', 'value: V'], returnType: 'void', jsImpl: '.set' },
        { name: 'has', params: ['key: K'], returnType: 'bool', jsImpl: '.has' },
        { name: 'delete', params: ['key: K'], returnType: 'bool', jsImpl: '.delete' },
        { name: 'len', params: [], returnType: 'usize', jsImpl: '.size' },
        { name: 'keys', params: [], returnType: 'Iterator<K>', jsImpl: '.keys' },
        { name: 'values', params: [], returnType: 'Iterator<V>', jsImpl: '.values' },
      ],
    },
  ],
} as const;
```

`compiler/src/stdlib/string.ts`:
```typescript
/** String module — string manipulation utilities. */
export const STRING_MODULE = {
  name: 'string',
  methods: [
    { name: 'len', params: [], returnType: 'usize', jsImpl: '.length' },
    { name: 'is_empty', params: [], returnType: 'bool', jsImpl: '((s) => s.length === 0)' },
    { name: 'contains', params: ['substr: &str'], returnType: 'bool', jsImpl: '.includes' },
    { name: 'starts_with', params: ['prefix: &str'], returnType: 'bool', jsImpl: '.startsWith' },
    { name: 'ends_with', params: ['suffix: &str'], returnType: 'bool', jsImpl: '.endsWith' },
    { name: 'to_uppercase', params: [], returnType: 'String', jsImpl: '.toUpperCase' },
    { name: 'to_lowercase', params: [], returnType: 'String', jsImpl: '.toLowerCase' },
    { name: 'trim', params: [], returnType: 'String', jsImpl: '.trim' },
    { name: 'split', params: ['sep: &str'], returnType: 'Vec<String>', jsImpl: '.split' },
    { name: 'replace', params: ['from: &str', 'to: &str'], returnType: 'String', jsImpl: '.replace' },
    { name: 'chars', params: [], returnType: 'Vec<char>', jsImpl: '((s) => [...s])' },
    { name: 'parse_int', params: [], returnType: 'Result<i64, ParseError>', jsImpl: 'parseInt' },
    { name: 'parse_float', params: [], returnType: 'Result<f64, ParseError>', jsImpl: 'parseFloat' },
  ],
} as const;
```

`compiler/src/stdlib/index.ts`:
```typescript
export { IO_MODULE } from './io.js';
export { MATH_MODULE } from './math.js';
export { COLLECTIONS_MODULE } from './collections.js';
export { STRING_MODULE } from './string.js';

export const STDLIB_MODULES = ['io', 'math', 'collections', 'string'] as const;
```

**Step 2: Write tests**

`compiler/tests/stdlib.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { IO_MODULE, MATH_MODULE, COLLECTIONS_MODULE, STRING_MODULE, STDLIB_MODULES } from '../src/stdlib/index.js';

describe('Standard Library Modules', () => {
  it('exports all module names', () => {
    expect(STDLIB_MODULES).toEqual(['io', 'math', 'collections', 'string']);
  });

  describe('io module', () => {
    it('has print and println', () => {
      const names = IO_MODULE.functions.map(f => f.name);
      expect(names).toContain('print');
      expect(names).toContain('println');
    });

    it('maps println to console.log', () => {
      const println = IO_MODULE.functions.find(f => f.name === 'println');
      expect(println?.jsImpl).toBe('console.log');
    });
  });

  describe('math module', () => {
    it('has basic math functions', () => {
      const names = MATH_MODULE.functions.map(f => f.name);
      expect(names).toContain('abs');
      expect(names).toContain('sqrt');
      expect(names).toContain('min');
      expect(names).toContain('max');
    });

    it('has PI and E constants', () => {
      const names = MATH_MODULE.constants.map(c => c.name);
      expect(names).toContain('PI');
      expect(names).toContain('E');
    });
  });

  describe('collections module', () => {
    it('defines Vec type with methods', () => {
      const vec = COLLECTIONS_MODULE.types.find(t => t.name === 'Vec');
      expect(vec).toBeDefined();
      const methods = vec!.methods.map(m => m.name);
      expect(methods).toContain('push');
      expect(methods).toContain('pop');
      expect(methods).toContain('len');
      expect(methods).toContain('map');
      expect(methods).toContain('filter');
    });

    it('defines Map type with methods', () => {
      const map = COLLECTIONS_MODULE.types.find(t => t.name === 'Map');
      expect(map).toBeDefined();
      const methods = map!.methods.map(m => m.name);
      expect(methods).toContain('get');
      expect(methods).toContain('set');
      expect(methods).toContain('has');
    });
  });

  describe('string module', () => {
    it('has string manipulation methods', () => {
      const names = STRING_MODULE.methods.map(m => m.name);
      expect(names).toContain('len');
      expect(names).toContain('contains');
      expect(names).toContain('trim');
      expect(names).toContain('split');
      expect(names).toContain('to_uppercase');
    });
  });
});
```

**Step 3: Run tests, commit**

```bash
git add compiler/src/stdlib/ compiler/tests/stdlib.test.ts
git commit -m "feat(stdlib): add standard library foundation with io, math, collections, string modules"
```

---

### Task 6: Improve `cbang run` End-to-End

**Files:**
- Modify: `compiler/src/codegen/jsgen.ts` (enhance macro mapping)
- Create: `examples/demos/hello_run.cb`

**Step 1: Create a simple demo that should run end-to-end**

`examples/demos/hello_run.cb`:
```
fn main() {
    println!("Hello from C!");
    let x = 2 + 3;
    println!("2 + 3 = {x}");
}
```

**Step 2: Test `cbang run` manually**

Run: `cd compiler && npx tsx src/cli.ts run ../examples/demos/hello_run.cb`
Expected output:
```
Hello from C!
2 + 3 = 5
```

**Step 3: Add `print!` macro mapping (alongside existing `println!`)**

In `jsgen.ts` `exprToString` MacroCall case, add `print` mapping (already done — verify it works).

**Step 4: Commit**

```bash
git add examples/demos/hello_run.cb
git commit -m "feat(cli): add hello_run demo and verify cbang run end-to-end"
```

---

### Task 7: Better Error Messages with Source Context

**Files:**
- Modify: `compiler/src/errors/index.ts` (if it exists, check)
- Modify: `compiler/src/cli.ts`

**Step 1: Check current error formatting**

Read `compiler/src/errors/` to understand current state.

**Step 2: Enhance `formatDiagnostic` to show source line and caret**

If not already showing source context, add:
- The offending source line
- A caret `^` pointing to the error column
- Color output using ANSI codes

**Step 3: Test by intentionally creating a file with errors**

**Step 4: Commit**

```bash
git add compiler/src/errors/ compiler/src/cli.ts
git commit -m "feat(cli): improve error messages with source context and caret indicators"
```

---

### Task 8: Online Playground

**Files:**
- Create: `website/playground/index.html`
- Create: `website/playground/playground.js`
- Create: `website/playground/playground.css`
- Modify: `website/index.html` (add playground link)

**Step 1: Create playground HTML page**

A single-page app with:
- Left panel: CodeMirror editor (loaded from CDN) with C! source
- Right panel: output (JS output + console output)
- Top bar: "Run" button, example selector dropdown
- Bundles the C! compiler (lexer + parser + codegen) as a browser-compatible module

**Step 2: Create browser bundle of compiler**

Use esbuild to bundle `compiler/src/index.ts` as an IIFE for browser use.
Add a build script: `npm run build:browser` in compiler/package.json.

**Step 3: Wire up playground**

The playground imports the browser bundle, compiles C! to JS in the browser, and evals the result in a sandboxed iframe or captures console.log output.

**Step 4: Add example programs dropdown**

Include hello.cb, ownership.cb, pattern_matching.cb as built-in examples.

**Step 5: Commit**

```bash
git add website/playground/ compiler/package.json
git commit -m "feat(playground): add browser-based C! playground with editor and live compilation"
```

---

### Task 9: Social Media Monitoring

**Step 1: Check Moltbook for new comments**

Run: `curl` commands to check Moltbook API for replies.

**Step 2: Check GitHub issues for new comments**

Run: `gh issue list` and check for new activity.

**Step 3: Respond to any pending interactions**

---

## Execution Order

Tasks 1-3 are independent of each other (all modify different methods in jsgen.ts) and can be done in parallel via subagents. Task 4 depends on 1-3. Tasks 5-8 are largely independent. Task 9 is standalone.
