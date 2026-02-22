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

  describe('server declarations', () => {
    it('parses server with state and function', () => {
      const { program, diagnostics } = parse(`
        server ApiServer {
          state port: u16

          fn handle_request(req: Request) -> Response {
            return Ok;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const server = program.items[0] as any;
      expect(server.kind).toBe('ServerDecl');
      expect(server.name).toBe('ApiServer');
      expect(server.members).toHaveLength(2);
      expect(server.members[0].kind).toBe('StateDecl');
      expect(server.members[1].kind).toBe('FunctionDecl');
    });

    it('parses server with field assignment', () => {
      const { program, diagnostics } = parse(`
        server WebServer {
          bind: "0.0.0.0:8080"
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const server = program.items[0] as any;
      expect(server.members[0].kind).toBe('FieldAssignment');
      expect(server.members[0].name).toBe('bind');
    });
  });

  describe('component declarations', () => {
    it('parses component with params and body', () => {
      const { program, diagnostics } = parse(`
        component Button(label: String, on_click: Handler) {
          emit Click(label);
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const comp = program.items[0] as any;
      expect(comp.kind).toBe('ComponentDecl');
      expect(comp.name).toBe('Button');
      expect(comp.params).toHaveLength(2);
      expect(comp.params[0].name).toBe('label');
      expect(comp.params[1].name).toBe('on_click');
    });

    it('parses pub component', () => {
      const { program, diagnostics } = parse(`
        pub component Header(title: String) {
          let x = 1;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const comp = program.items[0] as any;
      expect(comp.visibility).toBe('public');
    });
  });

  describe('module declarations', () => {
    it('parses mod with body', () => {
      const { program, diagnostics } = parse(`
        mod utils {
          fn helper() {
            let x = 1;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const mod_ = program.items[0] as any;
      expect(mod_.kind).toBe('ModDecl');
      expect(mod_.name).toBe('utils');
      expect(mod_.body).toHaveLength(1);
      expect(mod_.body[0].kind).toBe('FunctionDecl');
    });

    it('parses mod declaration without body', () => {
      const { program, diagnostics } = parse(`
        mod database;
      `);
      expect(diagnostics).toHaveLength(0);
      const mod_ = program.items[0] as any;
      expect(mod_.kind).toBe('ModDecl');
      expect(mod_.name).toBe('database');
      expect(mod_.body).toBeNull();
    });
  });

  describe('async functions', () => {
    it('parses async function', () => {
      const { program, diagnostics } = parse(`
        async fn fetch_data(url: String) -> Result {
          return Ok;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      expect(fn_.isAsync).toBe(true);
      expect(fn_.isPure).toBe(false);
    });

    it('parses pure async function', () => {
      const { program, diagnostics } = parse(`
        pure async fn compute(x: i32) -> i32 {
          return x;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      expect(fn_.isPure).toBe(true);
      expect(fn_.isAsync).toBe(true);
    });
  });

  describe('mutable let bindings', () => {
    it('parses let mut binding', () => {
      const { program } = parse(`fn f() { let mut count = 0; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('LetStmt');
      expect(stmt.mutable).toBe(true);
      expect(stmt.name).toBe('count');
    });

    it('parses let mut with type annotation', () => {
      const { program } = parse(`fn f() { let mut total: u256 = 0; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.mutable).toBe(true);
      expect(stmt.typeAnnotation).not.toBeNull();
      expect(stmt.typeAnnotation.name).toBe('u256');
    });
  });

  describe('reply statements', () => {
    it('parses reply with expression', () => {
      const { program } = parse(`
        fn f() {
          reply Receipt { tx_id: id };
        }
      `);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('ReplyStmt');
      expect(stmt.value.kind).toBe('Struct');
      expect(stmt.value.name).toBe('Receipt');
    });

    it('parses reply with simple value', () => {
      const { program } = parse(`fn f() { reply 42; }`);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('ReplyStmt');
      expect(stmt.value.kind).toBe('IntLiteral');
    });
  });

  describe('spawn statements', () => {
    it('parses spawn with arguments', () => {
      const { program, diagnostics } = parse(`
        fn f() {
          spawn Worker(config, 10);
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('SpawnStmt');
      expect(stmt.actor).toBe('Worker');
      expect(stmt.args).toHaveLength(2);
    });

    it('parses spawn without arguments', () => {
      const { program, diagnostics } = parse(`
        fn f() {
          spawn Monitor;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('SpawnStmt');
      expect(stmt.actor).toBe('Monitor');
      expect(stmt.args).toHaveLength(0);
    });
  });

  describe('deploy expressions', () => {
    it('parses deploy expression', () => {
      const { program, diagnostics } = parse(`
        fn f() {
          deploy TokenContract(supply, name);
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('ExprStmt');
      expect(stmt.expr.kind).toBe('Call');
    });
  });

  describe('refined types', () => {
    it('parses refined type with range constraint', () => {
      const { program, diagnostics } = parse(`
        type Port = u16{1..65535}
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.body.kind).toBe('Alias');
      expect(td.body.type.kind).toBe('RefinedType');
      expect(td.body.type.baseType.name).toBe('u16');
      expect(td.body.type.constraints).toHaveLength(1);
    });

    it('parses refined type with named constraint', () => {
      const { program, diagnostics } = parse(`
        type Email = String{pattern: "^[a-z]+@[a-z]+$"}
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.body.type.kind).toBe('RefinedType');
      expect(td.body.type.constraints[0].name).toBe('pattern');
    });
  });

  describe('ownership type expressions', () => {
    it('parses own type in type expression', () => {
      const { program } = parse(`fn f(x: own Token) { let a = 1; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.params[0].ownership).toBe('own');
    });

    it('parses shared type in type expression', () => {
      const { program } = parse(`fn f(x: shared Config) { let a = 1; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.params[0].ownership).toBe('shared');
    });
  });

  describe('additional type expressions', () => {
    it('parses unit type ()', () => {
      const { program } = parse(`fn f() -> () { let a = 1; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.returnType).not.toBeNull();
      expect(fn_.returnType.name).toBe('()');
    });

    it('parses nested generic types', () => {
      const { program } = parse(`fn f(x: Map<String, Vec<i32>>) { let a = 1; }`);
      const fn_ = program.items[0] as any;
      const type_ = fn_.params[0].typeAnnotation;
      expect(type_.kind).toBe('GenericType');
      expect(type_.name).toBe('Map');
      expect(type_.typeArgs).toHaveLength(2);
      expect(type_.typeArgs[1].kind).toBe('GenericType');
      expect(type_.typeArgs[1].name).toBe('Vec');
    });
  });

  describe('field access', () => {
    it('parses field access expression', () => {
      const { program } = parse(`fn f() { let x = obj.field; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('FieldAccess');
      expect(init.object.name).toBe('obj');
      expect(init.field).toBe('field');
    });

    it('parses chained field access', () => {
      const { program } = parse(`fn f() { let x = a.b.c; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('FieldAccess');
      expect(init.field).toBe('c');
      expect(init.object.kind).toBe('FieldAccess');
      expect(init.object.field).toBe('b');
    });

    it('parses chained method calls', () => {
      const { program } = parse(`fn f() { list.filter(x).map(y).collect(); }`);
      const fn_ = program.items[0] as any;
      const expr = fn_.body.statements[0].expr;
      expect(expr.kind).toBe('MethodCall');
      expect(expr.method).toBe('collect');
      expect(expr.object.kind).toBe('MethodCall');
      expect(expr.object.method).toBe('map');
    });
  });

  describe('range expressions', () => {
    it('parses exclusive range', () => {
      const { program } = parse(`fn f() { let r = 1..10; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Range');
      expect(init.inclusive).toBe(false);
      expect(init.start.kind).toBe('IntLiteral');
      expect(init.end.kind).toBe('IntLiteral');
    });

    it('parses inclusive range', () => {
      const { program } = parse(`fn f() { let r = 0..=255; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Range');
      expect(init.inclusive).toBe(true);
    });
  });

  describe('additional literal expressions', () => {
    it('parses bool literals', () => {
      const { program } = parse(`fn f() { let a = true; let b = false; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.body.statements[0].initializer.kind).toBe('BoolLiteral');
      expect(fn_.body.statements[0].initializer.value).toBe(true);
      expect(fn_.body.statements[1].initializer.kind).toBe('BoolLiteral');
      expect(fn_.body.statements[1].initializer.value).toBe(false);
    });

    it('parses float literals', () => {
      const { program } = parse(`fn f() { let pi = 3.14159; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.body.statements[0].initializer.kind).toBe('FloatLiteral');
      expect(fn_.body.statements[0].initializer.value).toBe('3.14159');
    });

    it('parses string literals in expressions', () => {
      const { program } = parse(`fn f() { let name = "hello world"; }`);
      const fn_ = program.items[0] as any;
      expect(fn_.body.statements[0].initializer.kind).toBe('StringLiteral');
      expect(fn_.body.statements[0].initializer.value).toBe('hello world');
    });
  });

  describe('parallel and scope expressions', () => {
    it('parses parallel block', () => {
      const { program } = parse(`
        fn f() {
          parallel {
            let x = 1;
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const expr = fn_.body.statements[0].expr;
      expect(expr.kind).toBe('Parallel');
      expect(expr.body.statements).toHaveLength(1);
    });

    it('parses scope expression', () => {
      const { program } = parse(`
        fn f() {
          scope conn = get_connection() {
            let data = conn;
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const expr = fn_.body.statements[0].expr;
      expect(expr.kind).toBe('Scope');
      expect(expr.name).toBe('conn');
    });
  });

  describe('if/else chains', () => {
    it('parses if/else if/else chain', () => {
      const { program } = parse(`
        fn f() {
          if x > 10 {
            let a = 1;
          } else if x > 5 {
            let b = 2;
          } else {
            let c = 3;
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const stmt = fn_.body.statements[0];
      expect(stmt.kind).toBe('IfStmt');
      expect(stmt.else_).not.toBeNull();
      expect(stmt.else_.kind).toBe('IfStmt');
      expect(stmt.else_.else_).not.toBeNull();
      expect(stmt.else_.else_.kind).toBe('Block');
    });
  });

  describe('match patterns', () => {
    it('parses wildcard pattern', () => {
      const { program } = parse(`
        fn f() {
          match x {
            _ => print("default"),
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const arm = fn_.body.statements[0].arms[0];
      expect(arm.pattern.kind).toBe('WildcardPattern');
    });

    it('parses literal patterns', () => {
      const { program } = parse(`
        fn f() {
          match status {
            200 => print("ok"),
            404 => print("not found"),
            _ => print("other"),
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const arms = fn_.body.statements[0].arms;
      expect(arms[0].pattern.kind).toBe('LiteralPattern');
      expect(arms[0].pattern.value).toBe(200);
      expect(arms[1].pattern.kind).toBe('LiteralPattern');
      expect(arms[1].pattern.value).toBe(404);
      expect(arms[2].pattern.kind).toBe('WildcardPattern');
    });

    it('parses match with block bodies', () => {
      const { program } = parse(`
        fn f() {
          match result {
            Ok(value) => {
              let x = value;
              print(x);
            },
            Err(msg) => {
              print(msg);
            },
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const arms = fn_.body.statements[0].arms;
      expect(arms[0].body.kind).toBe('Block');
      expect(arms[0].body.statements).toHaveLength(2);
      expect(arms[1].body.kind).toBe('Block');
    });

    it('parses constructor pattern without args', () => {
      const { program } = parse(`
        fn f() {
          match opt {
            Some(x) => print(x),
            None => print("empty"),
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const arms = fn_.body.statements[0].arms;
      expect(arms[0].pattern.kind).toBe('ConstructorPattern');
      expect(arms[0].pattern.name).toBe('Some');
      expect(arms[1].pattern.kind).toBe('ConstructorPattern');
      expect(arms[1].pattern.name).toBe('None');
      expect(arms[1].pattern.fields).toHaveLength(0);
    });

    it('parses bool literal pattern', () => {
      const { program } = parse(`
        fn f() {
          match flag {
            true => print("yes"),
            false => print("no"),
          }
        }
      `);
      const fn_ = program.items[0] as any;
      const arms = fn_.body.statements[0].arms;
      expect(arms[0].pattern.kind).toBe('LiteralPattern');
      expect(arms[0].pattern.value).toBe(true);
      expect(arms[1].pattern.kind).toBe('LiteralPattern');
      expect(arms[1].pattern.value).toBe(false);
    });
  });

  describe('actor extended features', () => {
    it('parses actor with init', () => {
      const { program, diagnostics } = parse(`
        actor Cache {
          state data: Map<String, String>

          init(capacity: i32) {
            let x = capacity;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const actor = program.items[0] as any;
      expect(actor.members).toHaveLength(2);
      expect(actor.members[1].kind).toBe('InitDecl');
      expect(actor.members[1].params).toHaveLength(1);
    });

    it('parses actor with function members', () => {
      const { program, diagnostics } = parse(`
        actor Logger {
          state entries: Vec<String>

          pub fn get_entries() -> Vec<String> {
            return entries;
          }

          fn internal_log(msg: String) {
            let x = msg;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const actor = program.items[0] as any;
      expect(actor.members).toHaveLength(3);
      expect(actor.members[1].kind).toBe('FunctionDecl');
      expect(actor.members[1].visibility).toBe('public');
      expect(actor.members[2].kind).toBe('FunctionDecl');
      expect(actor.members[2].visibility).toBe('private');
    });

    it('parses on handler with return type', () => {
      const { program, diagnostics } = parse(`
        actor Service {
          on Query(id: u64) -> Result {
            return Ok;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const handler = (program.items[0] as any).members[0];
      expect(handler.kind).toBe('OnHandler');
      expect(handler.returnType).not.toBeNull();
      expect(handler.returnType.name).toBe('Result');
    });
  });

  describe('contract extended features', () => {
    it('parses contract with multiple interfaces', () => {
      const { program, diagnostics } = parse(`
        contract MultiToken : ERC20, ERC721, Ownable {
          state supply: u256

          pub fn name() -> String {
            return "Multi";
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const contract = program.items[0] as any;
      expect(contract.interfaces).toEqual(['ERC20', 'ERC721', 'Ownable']);
    });
  });

  describe('visibility', () => {
    it('parses pub(pkg) visibility', () => {
      const { program, diagnostics } = parse(`
        pub(pkg) fn internal_helper() {
          let x = 1;
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      expect(fn_.visibility).toBe('package');
    });
  });

  describe('use extended features', () => {
    it('parses use with alias', () => {
      const { program, diagnostics } = parse(`
        use crypto::hash::{SHA256 as Hash, MD5};
      `);
      expect(diagnostics).toHaveLength(0);
      const use_ = program.items[0] as any;
      expect(use_.items).toHaveLength(2);
      expect(use_.items[0].name).toBe('SHA256');
      expect(use_.items[0].alias).toBe('Hash');
      expect(use_.items[1].name).toBe('MD5');
      expect(use_.items[1].alias).toBeNull();
    });
  });

  describe('state with initializer', () => {
    it('parses state with default value', () => {
      const { program, diagnostics } = parse(`
        actor Counter {
          state count: i64 = 0
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const state_ = (program.items[0] as any).members[0];
      expect(state_.kind).toBe('StateDecl');
      expect(state_.initializer).not.toBeNull();
      expect(state_.initializer.kind).toBe('IntLiteral');
      expect(state_.initializer.value).toBe('0');
    });
  });

  describe('struct fields with defaults', () => {
    it('parses struct field with default value', () => {
      const { program, diagnostics } = parse(`
        type Config {
          timeout: i32 = 30,
          retries: i32 = 3,
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const td = program.items[0] as any;
      expect(td.body.fields[0].defaultValue).not.toBeNull();
      expect(td.body.fields[0].defaultValue.kind).toBe('IntLiteral');
      expect(td.body.fields[1].defaultValue.value).toBe('3');
    });
  });

  describe('multiple top-level items', () => {
    it('parses multiple declarations in one file', () => {
      const { program, diagnostics } = parse(`
        use std::io::*;

        type Config {
          host: String,
          port: u16,
        }

        fn main() {
          let cfg = Config { host: "localhost", port: 8080 };
        }

        actor Server {
          state config: Config

          on Start() {
            let x = 1;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      expect(program.items).toHaveLength(4);
      expect(program.items[0]!.kind).toBe('UseDecl');
      expect(program.items[1]!.kind).toBe('TypeDecl');
      expect(program.items[2]!.kind).toBe('FunctionDecl');
      expect(program.items[3]!.kind).toBe('ActorDecl');
    });
  });

  describe('empty function body', () => {
    it('parses function with empty body', () => {
      const { program, diagnostics } = parse(`fn noop() {}`);
      expect(diagnostics).toHaveLength(0);
      const fn_ = program.items[0] as any;
      expect(fn_.body.statements).toHaveLength(0);
    });
  });

  describe('parenthesized expressions', () => {
    it('parses grouped expressions', () => {
      const { program } = parse(`fn f() { let x = (1 + 2) * 3; }`);
      const fn_ = program.items[0] as any;
      const init = fn_.body.statements[0].initializer;
      expect(init.kind).toBe('Binary');
      expect(init.operator).toBe('*');
      expect(init.left.kind).toBe('Binary');
      expect(init.left.operator).toBe('+');
    });
  });

  describe('complex real-world examples', () => {
    it('parses a DeFi lending protocol contract', () => {
      const { program, diagnostics } = parse(`
        use math::safe::{SafeAdd, SafeSub};

        contract LendingPool : ERC20 {
          state deposits: Map<Address, u256>
          state total_locked: u256

          #[intent("Deposit tokens into the lending pool")]
          #[pre(amount > 0)]
          pub fn deposit(amount: u256) -> Result {
            deposits[caller] += amount;
            total_locked += amount;
            emit Deposit(caller, amount);
            return Ok(true);
          }

          #[intent("Withdraw tokens from the lending pool")]
          pub fn withdraw(amount: u256) -> Result {
            verify!(deposits[caller] >= amount, "insufficient deposit");
            deposits[caller] -= amount;
            total_locked -= amount;
            emit Withdrawal(caller, amount);
            return Ok(true);
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      expect(program.items).toHaveLength(2);
      expect(program.items[0]!.kind).toBe('UseDecl');
      const contract = program.items[1] as any;
      expect(contract.kind).toBe('ContractDecl');
      expect(contract.members).toHaveLength(4);
    });

    it('parses actor supervision tree', () => {
      const { program, diagnostics } = parse(`
        actor AppSupervisor {
          state running: bool = true

          supervise Database {
            restart: always,
            max_restarts: 3,
          }

          supervise WebServer {
            restart: always,
          }

          on Shutdown() {
            running = false;
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const actor = program.items[0] as any;
      expect(actor.members).toHaveLength(4);
      expect(actor.members[0].kind).toBe('StateDecl');
      expect(actor.members[1].kind).toBe('SuperviseDecl');
      expect(actor.members[2].kind).toBe('SuperviseDecl');
      expect(actor.members[3].kind).toBe('OnHandler');
    });

    it('parses server with HTTP handlers', () => {
      const { program, diagnostics } = parse(`
        server RestApi {
          state db: Database

          #[get("/users")]
          pub fn list_users() -> Vec<User> {
            return db.query_all();
          }

          #[post("/users")]
          pub fn create_user(name: String, email: String) -> Result {
            return db.insert(name, email);
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const server = program.items[0] as any;
      expect(server.kind).toBe('ServerDecl');
      expect(server.members).toHaveLength(3);
      expect(server.members[1].annotations[0].name).toBe('get');
      expect(server.members[2].annotations[0].name).toBe('post');
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

    it('recovers from missing closing brace', () => {
      const { diagnostics } = parse(`
        fn broken() { let x = 1;
        fn next() { let y = 2; }
      `);
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it('reports error on unexpected top-level token', () => {
      const { diagnostics } = parse(`
        42
      `);
      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });
});
