import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';
import { JsGenerator } from '../src/codegen/index.js';

/** Parse C! source and generate JavaScript */
function generate(source: string): string {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const gen = new JsGenerator();
  return gen.generate(program);
}

/** Trim leading/trailing whitespace and normalize blank lines for comparison */
function normalize(s: string): string {
  return s.trim().replace(/\r\n/g, '\n');
}

describe('JsGenerator', () => {
  // ─── 1. Simple function ──────────────────────────────────────────

  describe('function declarations', () => {
    it('generates a simple function', () => {
      const js = generate(`
        fn main() {
          let x = 42;
        }
      `);
      expect(normalize(js)).toBe(normalize(`
function main() {
  const x = 42;
}
      `));
    });

    it('generates a function with parameters', () => {
      const js = generate(`
        fn add(a: i32, b: i32) -> i32 {
          return a + b;
        }
      `);
      expect(normalize(js)).toBe(normalize(`
function add(a, b) {
  return a + b;
}
      `));
    });

    it('generates an async function', () => {
      const js = generate(`
        async fn fetch_data() {
          let result = get_data();
        }
      `);
      expect(normalize(js)).toBe(normalize(`
async function fetch_data() {
  const result = get_data();
}
      `));
    });

    it('generates a public function with export', () => {
      const js = generate(`
        pub fn greet(name: String) -> String {
          return name;
        }
      `);
      expect(normalize(js)).toBe(normalize(`
export function greet(name) {
  return name;
}
      `));
    });

    it('generates a function with return (no value)', () => {
      const js = generate(`
        fn early_exit() {
          return;
        }
      `);
      expect(normalize(js)).toBe(normalize(`
function early_exit() {
  return;
}
      `));
    });
  });

  // ─── 2. Let bindings ─────────────────────────────────────────────

  describe('let bindings', () => {
    it('generates const for immutable let', () => {
      const js = generate(`
        fn main() {
          let x = 42;
        }
      `);
      expect(js).toContain('const x = 42;');
    });

    it('generates let for mutable let', () => {
      const js = generate(`
        fn main() {
          let mut count = 0;
        }
      `);
      expect(js).toContain('let count = 0;');
    });

    it('generates let bindings with expressions', () => {
      const js = generate(`
        fn main() {
          let sum = 1 + 2;
          let mut total = sum;
        }
      `);
      expect(js).toContain('const sum = 1 + 2;');
      expect(js).toContain('let total = sum;');
    });
  });

  // ─── 3. If/else statements ───────────────────────────────────────

  describe('if/else statements', () => {
    it('generates if statement', () => {
      const js = generate(`
        fn main() {
          if true {
            let x = 1;
          }
        }
      `);
      expect(js).toContain('if (true) {');
      expect(js).toContain('const x = 1;');
    });

    it('generates if/else statement', () => {
      const js = generate(`
        fn main() {
          if x > 0 {
            let a = 1;
          } else {
            let b = 2;
          }
        }
      `);
      expect(js).toContain('if (x > 0) {');
      expect(js).toContain('} else {');
    });

    it('generates if/else if/else chain', () => {
      const js = generate(`
        fn main() {
          if x > 10 {
            let a = 1;
          } else if x > 5 {
            let b = 2;
          } else {
            let c = 3;
          }
        }
      `);
      expect(js).toContain('if (x > 10) {');
      expect(js).toContain('} else if (x > 5) {');
      expect(js).toContain('} else {');
    });
  });

  // ─── 4. While loops ──────────────────────────────────────────────

  describe('while loops', () => {
    it('generates while loop', () => {
      const js = generate(`
        fn main() {
          let mut i = 0;
          while i < 10 {
            i += 1;
          }
        }
      `);
      expect(js).toContain('while (i < 10) {');
      expect(js).toContain('i += 1;');
    });
  });

  // ─── 5. For loops ────────────────────────────────────────────────

  describe('for loops', () => {
    it('generates for-of loop', () => {
      const js = generate(`
        fn main() {
          for item in items {
            let x = item;
          }
        }
      `);
      expect(js).toContain('for (const item of items) {');
    });
  });

  // ─── 6. Match statements ─────────────────────────────────────────

  describe('match statements', () => {
    it('generates match as if/else chain with literals', () => {
      const js = generate(`
        fn main() {
          match x {
            1 => { let a = 10; },
            2 => { let b = 20; },
            _ => { let c = 30; },
          }
        }
      `);
      expect(js).toContain('if (x === 1) {');
      expect(js).toContain('} else if (x === 2) {');
      expect(js).toContain('} else {');
    });

    it('generates match with identifier binding', () => {
      const js = generate(`
        fn main() {
          match value {
            x => { let y = x; },
          }
        }
      `);
      expect(js).toContain('const x = value;');
    });
  });

  // ─── 7. Binary expressions with precedence ───────────────────────

  describe('binary expressions', () => {
    it('preserves arithmetic operator precedence', () => {
      const js = generate(`
        fn main() {
          let x = 1 + 2 * 3;
        }
      `);
      // The parser already handles precedence in the AST tree structure.
      // 1 + (2 * 3) should NOT need parens around 2 * 3 since * > +
      expect(js).toContain('const x = 1 + 2 * 3;');
    });

    it('adds parens when lower-precedence is nested', () => {
      const js = generate(`
        fn main() {
          let x = (1 + 2) * 3;
        }
      `);
      expect(js).toContain('const x = (1 + 2) * 3;');
    });

    it('generates comparison operators', () => {
      const js = generate(`
        fn main() {
          let a = x == y;
          let b = x != y;
          let c = x <= y;
        }
      `);
      expect(js).toContain('const a = x == y;');
      expect(js).toContain('const b = x != y;');
      expect(js).toContain('const c = x <= y;');
    });

    it('generates logical operators', () => {
      const js = generate(`
        fn main() {
          let x = a && b || c;
        }
      `);
      // a && b has higher precedence than ||, so the AST is (a && b) || c
      expect(js).toContain('const x = a && b || c;');
    });
  });

  // ─── 8. String interpolation ─────────────────────────────────────

  describe('string interpolation', () => {
    it('generates template literals', () => {
      const js = generate(`
        fn main() {
          let name = "World";
          let greeting = "Hello {name}!";
        }
      `);
      // The string "Hello {name}!" is parsed as interpolation with parts
      expect(js).toContain('`Hello ${name}!`');
    });
  });

  // ─── 9. Array literals ───────────────────────────────────────────

  describe('array literals', () => {
    it('generates array literals', () => {
      const js = generate(`
        fn main() {
          let nums = [1, 2, 3];
        }
      `);
      expect(js).toContain('const nums = [1, 2, 3];');
    });

    it('generates empty array', () => {
      const js = generate(`
        fn main() {
          let empty = [];
        }
      `);
      expect(js).toContain('const empty = [];');
    });
  });

  // ─── 10. Struct expressions → object literals ─────────────────────

  describe('struct expressions', () => {
    it('generates object literals from struct expressions', () => {
      const js = generate(`
        fn main() {
          let p = Point { x: 1, y: 2 };
        }
      `);
      expect(js).toContain('const p = { x: 1, y: 2 };');
    });
  });

  // ─── 11. Closures → arrow functions ───────────────────────────────

  describe('closures', () => {
    it('generates arrow function from closure with expression body', () => {
      const js = generate(`
        fn main() {
          let double = |x: i32| x * 2;
        }
      `);
      expect(js).toContain('(x) => x * 2');
    });

    it('generates arrow function from closure with block body', () => {
      const js = generate(`
        fn main() {
          let add = |a: i32, b: i32| { return a + b; };
        }
      `);
      expect(js).toContain('(a, b) =>');
      expect(js).toContain('a + b');
    });

    it('generates arrow function with no params', () => {
      const js = generate(`
        fn main() {
          let greet = || "hello";
        }
      `);
      expect(js).toContain('() => "hello"');
    });
  });

  // ─── 12. Type declarations → classes ──────────────────────────────

  describe('type declarations', () => {
    it('generates class from struct type', () => {
      const js = generate(`
        type Point {
          x: i32,
          y: i32,
        }
      `);
      expect(js).toContain('class Point {');
      expect(js).toContain('constructor(x, y) {');
      expect(js).toContain('this.x = x;');
      expect(js).toContain('this.y = y;');
    });

    it('generates comment for type alias', () => {
      const js = generate(`
        type Age = i32
      `);
      expect(js).toContain('/* type Age = ... (alias) */');
    });
  });

  // ─── 13. Enum declarations ────────────────────────────────────────

  describe('enum declarations', () => {
    it('generates const object from enum with unit variants', () => {
      const js = generate(`
        enum Color {
          Red,
          Green,
          Blue,
        }
      `);
      expect(js).toContain('const Color = Object.freeze({');
      expect(js).toContain('Red: "Red"');
      expect(js).toContain('Green: "Green"');
      expect(js).toContain('Blue: "Blue"');
    });

    it('generates factory functions for tuple variants', () => {
      const js = generate(`
        enum Shape {
          Circle(f64),
          Rect(f64, f64),
        }
      `);
      expect(js).toContain('Circle: (...args) => ({ tag: "Circle", values: args })');
      expect(js).toContain('Rect: (...args) => ({ tag: "Rect", values: args })');
    });
  });

  // ─── 14. Nested scopes ───────────────────────────────────────────

  describe('nested scopes', () => {
    it('handles nested if inside while', () => {
      const js = generate(`
        fn main() {
          let mut i = 0;
          while i < 10 {
            if i > 5 {
              let x = i;
            }
            i += 1;
          }
        }
      `);
      expect(js).toContain('while (i < 10) {');
      expect(js).toContain('if (i > 5) {');
      expect(js).toContain('const x = i;');
      expect(js).toContain('i += 1;');
    });

    it('handles nested for inside function', () => {
      const js = generate(`
        fn process(items: [i32]) {
          for item in items {
            let doubled = item * 2;
          }
        }
      `);
      expect(js).toContain('function process(items) {');
      expect(js).toContain('for (const item of items) {');
      expect(js).toContain('const doubled = item * 2;');
    });
  });

  // ─── 15. Actor declarations → classes ───────────────────────────────

  describe('actor declarations', () => {
    it('generates class with state in constructor', () => {
      const js = generate(`
        actor Counter {
          state count: i32 = 0
        }
      `);
      expect(js).toContain('class Counter {');
      expect(js).toContain('constructor() {');
      expect(js).toContain('this.count = 0;');
    });

    it('generates on handlers as methods', () => {
      const js = generate(`
        actor Counter {
          state count: i32 = 0

          on Increment() {
            count += 1;
          }

          on Add(n: i32) {
            count += n;
          }
        }
      `);
      expect(js).toContain('class Counter {');
      expect(js).toContain('onIncrement() {');
      expect(js).toContain('onAdd(n) {');
    });

    it('generates multiple state fields', () => {
      const js = generate(`
        actor Worker {
          state id: u64 = 0
          state tasks_completed: u64 = 0
        }
      `);
      expect(js).toContain('this.id = 0;');
      expect(js).toContain('this.tasks_completed = 0;');
    });

    it('generates state without initializer as undefined', () => {
      const js = generate(`
        actor Worker {
          state name: String
        }
      `);
      expect(js).toContain('this.name = undefined;');
    });

    it('generates regular functions as methods', () => {
      const js = generate(`
        actor ChatRoom {
          state members: i32 = 0

          fn broadcast(msg: String) {
            let x = msg;
          }
        }
      `);
      expect(js).toContain('broadcast(msg) {');
      expect(js).toContain('const x = msg;');
    });

    it('generates public actor with export', () => {
      const js = generate(`
        pub actor Service {
          state running: bool = true
        }
      `);
      expect(js).toContain('export class Service {');
    });

    it('generates supervise declarations as comments', () => {
      const js = generate(`
        actor Application {
          supervise Worker { restart: .always }
        }
      `);
      expect(js).toContain('/* supervise Worker */');
    });

    it('generates actor with annotations', () => {
      const js = generate(`
        #[intent(manage chat messages)]
        actor ChatRoom {
          state count: i32 = 0
        }
      `);
      expect(js).toContain('/* @intent(manage chat messages) */');
      expect(js).toContain('class ChatRoom {');
    });
  });

  // ─── 15b. Contract declarations ────────────────────────────────────

  describe('contract declarations', () => {
    it('generates class with state in constructor', () => {
      const js = generate(`
        contract Token {
          state supply: u256 = 0
        }
      `);
      expect(js).toContain('class Token {');
      expect(js).toContain('constructor() {');
      expect(js).toContain('this.supply = 0;');
    });

    it('generates contract with init block', () => {
      const js = generate(`
        contract TokenSwap {
          state token_a: Address
          state token_b: Address

          init(a: Address, b: Address) {
            token_a = a;
            token_b = b;
          }
        }
      `);
      expect(js).toContain('class TokenSwap {');
      expect(js).toContain('constructor(a, b) {');
      expect(js).toContain('this.token_a = undefined;');
      expect(js).toContain('this.token_b = undefined;');
      expect(js).toContain('token_a = a;');
    });

    it('generates contract functions as methods', () => {
      const js = generate(`
        contract Token {
          state supply: u256 = 0

          pub fn mint(amount: u256) {
            supply += amount;
          }

          pub pure fn get_supply() {
            return supply;
          }
        }
      `);
      expect(js).toContain('class Token {');
      expect(js).toContain('mint(amount) {');
      expect(js).toContain('get_supply() {');
    });

    it('generates public contract with export', () => {
      const js = generate(`
        pub contract Registry {
          state count: u256 = 0
        }
      `);
      expect(js).toContain('export class Registry {');
    });

    it('generates contract annotations as comments', () => {
      const js = generate(`
        #[intent(manage token supply)]
        contract Token {
          state supply: u256 = 0
        }
      `);
      expect(js).toContain('/* @intent(manage token supply) */');
      expect(js).toContain('class Token {');
    });

    it('generates function annotations inside contract', () => {
      const js = generate(`
        contract Token {
          state supply: u256 = 0

          #[intent(mint new tokens)]
          pub fn mint(amount: u256) {
            supply += amount;
          }
        }
      `);
      expect(js).toContain('/* @intent(mint new tokens) */');
      expect(js).toContain('mint(amount) {');
    });
  });

  // ─── 15c. Server declarations ─────────────────────────────────────

  describe('server declarations', () => {
    it('generates class with handler methods', () => {
      const js = generate(`
        server Api {
          fn handle() {
            let x = 1;
          }
        }
      `);
      expect(js).toContain('class Api {');
      expect(js).toContain('handle() {');
      expect(js).toContain('const x = 1;');
    });

    it('generates server with state', () => {
      const js = generate(`
        server App {
          state port: u16 = 8080

          fn start() {
            let running = true;
          }
        }
      `);
      expect(js).toContain('class App {');
      expect(js).toContain('this.port = 8080;');
      expect(js).toContain('start() {');
    });

    it('generates public server with export', () => {
      const js = generate(`
        pub server WebApp {
          fn index() {
            return "hello";
          }
        }
      `);
      expect(js).toContain('export class WebApp {');
    });

    it('generates server with annotations on handlers', () => {
      const js = generate(`
        server Api {
          #[intent(retrieve user data)]
          fn get_user(id: String) {
            let user = id;
          }
        }
      `);
      expect(js).toContain('/* @intent(retrieve user data) */');
      expect(js).toContain('get_user(id) {');
    });

    it('generates server with multiple handlers', () => {
      const js = generate(`
        server Api {
          fn get_users() {
            return users;
          }

          fn create_user(body: User) {
            return body;
          }

          fn delete_user(id: String) {
            return id;
          }
        }
      `);
      expect(js).toContain('get_users() {');
      expect(js).toContain('create_user(body) {');
      expect(js).toContain('delete_user(id) {');
    });
  });

  // ─── 15d. Component declarations ──────────────────────────────────

  describe('component declarations', () => {
    it('generates render function from component', () => {
      const js = generate(`
        component Greeting(name: String) {
          let msg = name;
        }
      `);
      expect(js).toContain('function Greeting(name) {');
      expect(js).toContain('const msg = name;');
    });

    it('generates public component with export', () => {
      const js = generate(`
        pub component Button(label: String) {
          let text = label;
        }
      `);
      expect(js).toContain('export function Button(label) {');
    });

    it('generates component with annotations', () => {
      const js = generate(`
        #[intent(display user profile)]
        component UserProfile(user: User) {
          let name = user;
        }
      `);
      expect(js).toContain('/* @intent(display user profile) */');
      expect(js).toContain('function UserProfile(user) {');
    });

    it('generates component with multiple params', () => {
      const js = generate(`
        component Card(title: String, content: String, footer: String) {
          let heading = title;
        }
      `);
      expect(js).toContain('function Card(title, content, footer) {');
    });
  });

  // ─── 15e. Spawn/Deploy/Emit statements ────────────────────────────

  describe('spawn, deploy, and emit statements', () => {
    it('generates spawn as constructor call', () => {
      const js = generate(`
        fn main() {
          spawn Worker(1, 2, 3);
        }
      `);
      expect(js).toContain('const __actor = new Worker(1, 2, 3);');
    });

    it('generates deploy as function call expression', () => {
      // deploy is parsed as a Call expression by the parser
      const js = generate(`
        fn main() {
          let token = deploy Token(name: "MyToken");
        }
      `);
      // deploy Token(...) becomes a call with callee "deploy Token"
      expect(js).toContain('deploy Token("MyToken")');
    });

    it('generates emit as method call', () => {
      const js = generate(`
        contract Token {
          state supply: u256 = 0

          pub fn mint(amount: u256) {
            supply += amount;
            emit Minted(amount);
          }
        }
      `);
      expect(js).toContain('this.emit("Minted", amount);');
    });
  });

  // ─── 15f. Use declarations as imports ─────────────────────────────

  describe('use declarations', () => {
    it('generates import for named use', () => {
      const js = generate(`
        use std::collections::{HashMap}
      `);
      expect(js).toContain('import { HashMap } from "./std/collections.js";');
    });

    it('generates import with alias', () => {
      const js = generate(`
        use io::net::{TcpStream as Tcp}
      `);
      expect(js).toContain('import { TcpStream as Tcp } from "./io/net.js";');
    });

    it('generates import for multiple items', () => {
      const js = generate(`
        use std::collections::{Vec, Map}
      `);
      expect(js).toContain('import { Vec, Map } from "./std/collections.js";');
    });
  });

  // ─── 16. Function calls and method calls ──────────────────────────

  describe('function and method calls', () => {
    it('generates function calls', () => {
      const js = generate(`
        fn main() {
          let result = compute(1, 2, 3);
        }
      `);
      expect(js).toContain('const result = compute(1, 2, 3);');
    });

    it('generates method calls', () => {
      const js = generate(`
        fn main() {
          let len = items.len();
        }
      `);
      expect(js).toContain('const len = items.len();');
    });
  });

  // ─── 17. Field access → property access ───────────────────────────

  describe('field access', () => {
    it('generates property access', () => {
      const js = generate(`
        fn main() {
          let name = user.name;
        }
      `);
      expect(js).toContain('const name = user.name;');
    });

    it('generates chained property access', () => {
      const js = generate(`
        fn main() {
          let city = user.address.city;
        }
      `);
      expect(js).toContain('const city = user.address.city;');
    });
  });

  // ─── 18. Index expressions → bracket access ──────────────────────

  describe('index expressions', () => {
    it('generates bracket access', () => {
      const js = generate(`
        fn main() {
          let first = items[0];
        }
      `);
      expect(js).toContain('const first = items[0];');
    });
  });

  // ─── 19. Unary expressions ───────────────────────────────────────

  describe('unary expressions', () => {
    it('generates negation', () => {
      const js = generate(`
        fn main() {
          let x = -42;
        }
      `);
      expect(js).toContain('const x = -42;');
    });

    it('generates logical not', () => {
      const js = generate(`
        fn main() {
          let x = !done;
        }
      `);
      expect(js).toContain('const x = !done;');
    });
  });

  // ─── 20. Assignment statements ────────────────────────────────────

  describe('assignment statements', () => {
    it('generates simple assignment', () => {
      const js = generate(`
        fn main() {
          let mut x = 0;
          x = 42;
        }
      `);
      expect(js).toContain('x = 42;');
    });

    it('generates compound assignment', () => {
      const js = generate(`
        fn main() {
          let mut total = 0;
          total += 10;
          total -= 3;
        }
      `);
      expect(js).toContain('total += 10;');
      expect(js).toContain('total -= 3;');
    });
  });

  // ─── 21. Intent annotations → comments ───────────────────────────

  describe('annotations', () => {
    it('emits intent annotations as comments', () => {
      const js = generate(`
        #[intent(transfer tokens safely)]
        fn transfer(to: String, amount: u256) {
          let x = amount;
        }
      `);
      expect(js).toContain('/* @intent(transfer tokens safely) */');
      expect(js).toContain('function transfer(to, amount) {');
    });
  });

  // ─── 22. Multiple top-level items ─────────────────────────────────

  describe('multiple items', () => {
    it('generates multiple functions', () => {
      const js = generate(`
        fn foo() {
          let a = 1;
        }
        fn bar() {
          let b = 2;
        }
      `);
      expect(js).toContain('function foo()');
      expect(js).toContain('function bar()');
    });
  });

  // ─── 23. Macro calls ─────────────────────────────────────────────

  describe('macro calls', () => {
    it('maps println! to console.log', () => {
      const js = generate(`
        fn main() {
          println!("hello");
        }
      `);
      expect(js).toContain('console.log("hello");');
    });
  });

  // ─── 24. Stateless — can be reused ───────────────────────────────

  describe('stateless per-call', () => {
    it('generates fresh output each call', () => {
      const gen = new JsGenerator();

      const lexer1 = new Lexer('fn a() {}', 'test.cb');
      const parser1 = new Parser(lexer1.tokenize());
      const { program: p1 } = parser1.parse();
      const js1 = gen.generate(p1);

      const lexer2 = new Lexer('fn b() {}', 'test.cb');
      const parser2 = new Parser(lexer2.tokenize());
      const { program: p2 } = parser2.parse();
      const js2 = gen.generate(p2);

      expect(js1).toContain('function a()');
      expect(js1).not.toContain('function b()');
      expect(js2).toContain('function b()');
      expect(js2).not.toContain('function a()');
    });
  });

  // ─── 25. Indentation correctness ─────────────────────────────────

  describe('indentation', () => {
    it('indents nested blocks correctly', () => {
      const js = generate(`
        fn main() {
          if true {
            while x > 0 {
              let y = 1;
            }
          }
        }
      `);
      const lines = js.split('\n').filter(l => l.trim().length > 0);
      // function body should be indented 2 spaces
      expect(lines.find(l => l.includes('if (true)'))).toMatch(/^  if/);
      // while body inside if should be 4 spaces
      expect(lines.find(l => l.includes('while (x > 0)'))).toMatch(/^    while/);
      // let inside while inside if should be 6 spaces
      expect(lines.find(l => l.includes('const y = 1;'))).toMatch(/^      const/);
    });
  });
});
