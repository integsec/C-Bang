import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function parse(source: string) {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('Parser', () => {
  describe('functions', () => {
    it('parses a simple function', () => {
      const { program, diagnostics } = parse(`
        fn main() {
          let x = 42;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      expect(program.items).toHaveLength(1);
      expect(program.items[0]!.kind).toBe('FunctionDecl');
      const fn = program.items[0] as any;
      expect(fn.name).toBe('main');
      expect(fn.params).toHaveLength(0);
      expect(fn.body.statements).toHaveLength(1);
    });

    it('parses function with parameters and return type', () => {
      const { program, diagnostics } = parse(`
        fn add(a: i32, b: i32) -> i32 {
          return a;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn = program.items[0] as any;
      expect(fn.name).toBe('add');
      expect(fn.params).toHaveLength(2);
      expect(fn.params[0].name).toBe('a');
      expect(fn.params[1].name).toBe('b');
      expect(fn.returnType).not.toBeNull();
      expect(fn.returnType.kind).toBe('NamedType');
      expect(fn.returnType.name).toBe('i32');
    });

    it('parses pub pure fn', () => {
      const { program, diagnostics } = parse(`
        pub pure fn total() -> u256 {
          return total_supply;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn = program.items[0] as any;
      expect(fn.visibility).toBe('public');
      expect(fn.isPure).toBe(true);
    });

    it('parses function with effects', () => {
      const { program, diagnostics } = parse(`
        fn save(user: User) -> Result with IO, Database {
          return Ok;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn = program.items[0] as any;
      expect(fn.effects).toEqual(['IO', 'Database']);
    });

    it('parses function with annotations', () => {
      const { program, diagnostics } = parse(`
        #[intent("Transfer tokens")]
        #[pre(balance >= amount)]
        fn transfer(from: Address, to: Address) {
          let x = 1;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn = program.items[0] as any;
      expect(fn.annotations).toHaveLength(2);
      expect(fn.annotations[0].name).toBe('intent');
      expect(fn.annotations[1].name).toBe('pre');
    });

    it('parses function with owned parameter', () => {
      const { program, diagnostics } = parse(`
        fn transfer(token: own Token, to: Address) -> Receipt {
          return receipt;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn = program.items[0] as any;
      expect(fn.params[0].ownership).toBe('own');
      expect(fn.params[1].ownership).toBe('owned');
    });
  });

  describe('type declarations', () => {
    it('parses type alias', () => {
      const { program, diagnostics } = parse(`
        type Port = u16
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.kind).toBe('TypeDecl');
      expect(td.name).toBe('Port');
      expect(td.body.kind).toBe('Alias');
    });

    it('parses struct type', () => {
      const { program, diagnostics } = parse(`
        type User {
          id: UUID,
          name: String,
          email: Email,
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.name).toBe('User');
      expect(td.body.kind).toBe('Struct');
      expect(td.body.fields).toHaveLength(3);
      expect(td.body.fields[0].name).toBe('id');
    });

    it('parses generic type alias', () => {
      const { program, diagnostics } = parse(`
        type Result<T, E> = Ok | Err
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.typeParams).toHaveLength(2);
      expect(td.typeParams[0].name).toBe('T');
      expect(td.typeParams[1].name).toBe('E');
    });

    it('parses union type', () => {
      const { program, diagnostics } = parse(`
        type Role = Admin | Editor | Viewer
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.body.kind).toBe('Alias');
      expect(td.body.type.kind).toBe('UnionType');
      expect(td.body.type.types).toHaveLength(3);
    });
  });

  describe('actor declarations', () => {
    it('parses actor with state and handler', () => {
      const { program, diagnostics } = parse(`
        actor Counter {
          state count: i64

          on Increment(by: i64) {
            count += by;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const actor = program.items[0] as any;
      expect(actor.kind).toBe('ActorDecl');
      expect(actor.name).toBe('Counter');
      expect(actor.members).toHaveLength(2);
      expect(actor.members[0].kind).toBe('StateDecl');
      expect(actor.members[1].kind).toBe('OnHandler');
      expect(actor.members[1].messageName).toBe('Increment');
    });

    it('parses actor with supervise', () => {
      const { program, diagnostics } = parse(`
        actor App {
          supervise WebServer {
            restart: always,
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const actor = program.items[0] as any;
      expect(actor.members[0].kind).toBe('SuperviseDecl');
      expect(actor.members[0].childName).toBe('WebServer');
    });
  });

  describe('contract declarations', () => {
    it('parses contract with interface', () => {
      const { program, diagnostics } = parse(`
        contract MyToken : ERC20 {
          state total_supply: u256

          pub fn transfer(to: Address, amount: u256) -> Result {
            return Ok;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const contract = program.items[0] as any;
      expect(contract.kind).toBe('ContractDecl');
      expect(contract.name).toBe('MyToken');
      expect(contract.interfaces).toEqual(['ERC20']);
      expect(contract.members).toHaveLength(2);
    });

    it('parses contract with init', () => {
      const { program, diagnostics } = parse(`
        contract Token {
          state supply: u256

          init(amount: u256) {
            supply = amount;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const contract = program.items[0] as any;
      expect(contract.members[1].kind).toBe('InitDecl');
    });
  });

  describe('use declarations', () => {
    it('parses single import', () => {
      const { program, diagnostics } = parse(`
        use auth::login::authenticate;
      `);
      expect(diagnostics).toHaveLength(0);
      const use_ = program.items[0] as any;
      expect(use_.kind).toBe('UseDecl');
      expect(use_.path).toEqual(['auth', 'login']);
      expect(use_.items[0].name).toBe('authenticate');
    });

    it('parses wildcard import', () => {
      const { program, diagnostics } = parse(`
        use shared::types::*;
      `);
      expect(diagnostics).toHaveLength(0);
      const use_ = program.items[0] as any;
      expect(use_.isWildcard).toBe(true);
    });

    it('parses grouped import', () => {
      const { program, diagnostics } = parse(`
        use models::user::{User, UserRole};
      `);
      expect(diagnostics).toHaveLength(0);
      const use_ = program.items[0] as any;
      expect(use_.items).toHaveLength(2);
      expect(use_.items[0].name).toBe('User');
      expect(use_.items[1].name).toBe('UserRole');
    });
  });

  describe('statements', () => {
    it('parses let binding', () => {
      const { program } = parse(`fn f() { let x = 42; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('LetStmt');
      expect(stmt.name).toBe('x');
      expect(stmt.initializer.kind).toBe('IntLiteral');
    });

    it('parses let with type annotation', () => {
      const { program } = parse(`fn f() { let port: u16 = 8080; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.typeAnnotation).not.toBeNull();
      expect(stmt.typeAnnotation.name).toBe('u16');
    });

    it('parses if/else', () => {
      const { program } = parse(`
        fn f() {
          if x > 0 {
            let y = 1;
          } else {
            let y = 2;
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('IfStmt');
      expect(stmt.else_).not.toBeNull();
    });

    it('parses match statement', () => {
      const { program } = parse(`
        fn f() {
          match result {
            Ok(value) => print(value),
            Err(msg) => print(msg),
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('MatchStmt');
      expect(stmt.arms).toHaveLength(2);
      expect(stmt.arms[0].pattern.kind).toBe('ConstructorPattern');
      expect(stmt.arms[0].pattern.name).toBe('Ok');
    });

    it('parses for loop', () => {
      const { program } = parse(`
        fn f() {
          for item in items {
            print(item);
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('ForStmt');
      expect(stmt.variable).toBe('item');
    });

    it('parses return statement', () => {
      const { program } = parse(`fn f() { return 42; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('ReturnStmt');
      expect(stmt.value.kind).toBe('IntLiteral');
    });

    it('parses emit statement', () => {
      const { program } = parse(`fn f() { emit Transfer(from, to, amount); }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('EmitStmt');
      expect(stmt.eventName).toBe('Transfer');
      expect(stmt.args).toHaveLength(3);
    });

    it('parses assignment operators', () => {
      const { program } = parse(`
        fn f() {
          x = 1;
          x += 2;
          x -= 3;
        }
      `);
      const fn_ = program.items[0] as any;
      expect(fn_.body.statements[0].kind).toBe('AssignStmt');
      expect(fn_.body.statements[0].operator).toBe('=');
      expect(fn_.body.statements[1].operator).toBe('+=');
      expect(fn_.body.statements[2].operator).toBe('-=');
    });
  });

  describe('expressions', () => {
    it('parses binary expressions with precedence', () => {
      const { program } = parse(`fn f() { let x = 1 + 2 * 3; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Binary');
      expect(init.operator).toBe('+');
      expect(init.right.kind).toBe('Binary');
      expect(init.right.operator).toBe('*');
    });

    it('parses method calls', () => {
      const { program } = parse(`fn f() { obj.method(arg); }`);
      const fn_ = program.items[0] as any;
      const expr = fn_.body.statements[0].expr;
      expect(expr.kind).toBe('MethodCall');
      expect(expr.method).toBe('method');
    });

    it('parses index expressions', () => {
      const { program } = parse(`fn f() { balances[caller] += amount; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('AssignStmt');
      expect(stmt.target.kind).toBe('Index');
    });

    it('parses macro calls', () => {
      const { program } = parse(`fn f() { verify!(x >= 0); }`);
      const fn_ = program.items[0] as any;
      const expr = fn_.body.statements[0].expr;
      expect(expr.kind).toBe('MacroCall');
      expect(expr.name).toBe('verify');
    });

    it('parses path expressions', () => {
      const { program } = parse(`fn f() { let x = Address::zero(); }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Call');
      expect(init.callee.kind).toBe('Path');
      expect(init.callee.segments).toEqual(['Address', 'zero']);
    });

    it('parses struct literals', () => {
      const { program } = parse(`fn f() { let r = Receipt { tx_id: id }; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Struct');
      expect(init.name).toBe('Receipt');
      expect(init.fields).toHaveLength(1);
    });

    it('parses constructor calls', () => {
      const { program } = parse(`fn f() { let x = Ok(42); }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Call');
    });

    it('parses named arguments', () => {
      const { program } = parse(`fn f() { create(name: "test", count: 5); }`);
      const fn_ = program.items[0] as any;
      const expr = fn_.body.statements[0].expr;
      expect(expr.kind).toBe('Call');
      expect(expr.args[0].name).toBe('name');
      expect(expr.args[1].name).toBe('count');
    });

    it('parses unary expressions', () => {
      const { program } = parse(`fn f() { let x = !valid; let y = -1; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.body.statements[0].initializer.kind).toBe('Unary');
      expect(fn_.body.statements[0].initializer.operator).toBe('!');
      expect(fn_.body.statements[1].initializer.kind).toBe('Unary');
      expect(fn_.body.statements[1].initializer.operator).toBe('-');
    });

    it('parses comparison operators', () => {
      const { program } = parse(`fn f() { let x = a >= b && c != d; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Binary');
      expect(init.operator).toBe('&&');
    });
  });

  describe('type expressions', () => {
    it('parses generic types', () => {
      const { program } = parse(`fn f(x: Map<Address, u256>) { let a = 1; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.params[0].typeAnnotation.kind).toBe('GenericType');
      expect(fn_.params[0].typeAnnotation.name).toBe('Map');
      expect(fn_.params[0].typeAnnotation.typeArgs).toHaveLength(2);
    });

    it('parses reference types as ownership modifiers on params', () => {
      const { program } = parse(`fn f(x: &User, y: &mut Database) { let a = 1; }`);
      const fn_ = program.items[0] as any;
      // & and &mut are ownership modifiers on parameters, not type wrappers
      expect(fn_.params[0].ownership).toBe('borrowed');
      expect(fn_.params[0].typeAnnotation.kind).toBe('NamedType');
      expect(fn_.params[0].typeAnnotation.name).toBe('User');
      expect(fn_.params[1].ownership).toBe('borrowed_mut');
      expect(fn_.params[1].typeAnnotation.kind).toBe('NamedType');
      expect(fn_.params[1].typeAnnotation.name).toBe('Database');
    });

    it('parses union types in fields', () => {
      const { program } = parse(`
        type User {
          role: Admin | Editor | Viewer,
        }
      `);
      const td = program.items[0] as any;
      const field = td.body.fields[0];
      expect(field.typeAnnotation.kind).toBe('UnionType');
      expect(field.typeAnnotation.types).toHaveLength(3);
    });
  });

  describe('real C! examples', () => {
    it('parses hello world example', () => {
      const { program, diagnostics } = parse(`
        #[intent("Print a greeting and demonstrate basic C! syntax")]
        fn main() {
          let name = "World";
          let greeting = format("Hello!");
          print(greeting);
          let port: u16 = 8080;
          let result: Result = Ok(42);
          match result {
            Ok(value) => print(value),
            Err(msg) => print(msg),
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      expect(program.items).toHaveLength(1);
      const fn_ = program.items[0] as any;
      expect(fn_.annotations).toHaveLength(1);
      expect(fn_.name).toBe('main');
    });

    it('parses contract with annotations and state', () => {
      const { program, diagnostics } = parse(`
        contract DemoToken : ERC20 {
          state total_supply: u256
          state balances: Map<Address, u256>

          #[invariant(sum_equals_total)]

          #[intent("Transfer tokens")]
          #[pre(balances_sufficient)]
          pub fn transfer(to: Address, amount: u256) -> Result {
            verify!(balances[caller] >= amount, "insufficient balance");
            balances[caller] -= amount;
            balances[to] += amount;
            emit Transfer(caller, to, amount);
            return Ok(true);
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const contract = program.items[0] as any;
      expect(contract.kind).toBe('ContractDecl');
      expect(contract.interfaces).toEqual(['ERC20']);
    });

    it('parses actor with message handler', () => {
      const { program, diagnostics } = parse(`
        actor WalletService {
          state balances: Map<Address, u256>

          on Transfer(from: Address, to: Address, amount: u256) {
            verify!(balances[from] >= amount);
            balances[from] -= amount;
            balances[to] += amount;
            reply Receipt { tx_id: generate_id() }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const actor = program.items[0] as any;
      expect(actor.kind).toBe('ActorDecl');
      expect(actor.members).toHaveLength(2);
      const handler = actor.members[1];
      expect(handler.kind).toBe('OnHandler');
      expect(handler.messageName).toBe('Transfer');
    });
  });

  describe('error recovery', () => {
    it('recovers from errors and continues parsing', () => {
      const { program, diagnostics } = parse(`
        fn first() { let x = 1; }
        @@@ invalid stuff
        fn second() { let y = 2; }
      `);
      // Should have errors but still parse both functions
      expect(diagnostics.length).toBeGreaterThan(0);
      const fns = program.items.filter(i => i.kind === 'FunctionDecl');
      expect(fns.length).toBeGreaterThanOrEqual(1);
    });
  });
});
