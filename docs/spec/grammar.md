# C! (C-Bang) Language Grammar

This document defines the formal grammar of the C! programming language using
Extended Backus-Naur Form (EBNF). It describes exactly the syntax that the
current C! parser accepts.

---

## Notation

This grammar uses the following EBNF conventions:

| Notation        | Meaning                                              |
|-----------------|------------------------------------------------------|
| `"keyword"`     | A literal terminal token (keyword, operator, or punctuation) |
| `PascalCase`    | A non-terminal production rule                       |
| `A \| B`        | Alternatives: A or B                                 |
| `[ A ]`         | Optional: zero or one occurrence of A                |
| `{ A }`         | Repetition: zero or more occurrences of A            |
| `( A )`         | Grouping                                             |
| `(* text *)`    | Comment explaining the rule                          |
| `,`             | Sequence (elements in order)                         |

Non-terminals beginning with an uppercase letter represent syntax rules.
Quoted strings represent exact textual tokens. Token-level rules (lexical
grammar) are prefixed with explanation of how the lexer produces them.

---

## 1. Lexical Grammar

The lexer converts raw source text into a flat stream of tokens. Whitespace
(spaces, tabs, carriage returns, newlines) is consumed between tokens and does
not appear in the token stream. Comments are produced as tokens but are
filtered out before parsing.

### 1.1 Whitespace

```
Whitespace = " " | "\t" | "\r" | "\n" ;
```

Whitespace is skipped by the lexer and does not produce tokens consumed by the
parser.

### 1.2 Comments

```
LineComment  = "//" , { ANY except "\n" } ;
BlockComment = "/*" , { ANY | BlockComment } , "*/" ;
```

Block comments nest: each `/*` increases a depth counter and each `*/`
decreases it. The comment ends when depth reaches zero.

Comment tokens are filtered out before the parser sees them.

### 1.3 Identifiers and Type Identifiers

```
IdentStart = "a".."z" | "A".."Z" | "_" ;
IdentPart  = IdentStart | "0".."9" ;

RawIdentifier = IdentStart , { IdentPart } ;
```

After lexing a `RawIdentifier`, the lexer classifies it:

1. If the text matches a keyword (see below), it becomes that keyword token.
2. If the text is `"true"` or `"false"`, it becomes a `BoolLiteral` token.
3. If the first character is an uppercase ASCII letter (`A`..`Z`) **and** the
   text contains at least one lowercase letter, it becomes a `TypeIdentifier`.
4. Otherwise it becomes an `Identifier`.

**Examples:**

- `foo`, `my_var`, `x1` -- `Identifier`
- `UserProfile`, `ChatRoom`, `Ok` -- `TypeIdentifier`
- `fn`, `let`, `actor` -- keyword tokens
- `true`, `false` -- `BoolLiteral`
- `URL`, `HTTP`, `_Foo` -- `Identifier` (all-caps or underscore-prefixed)

### 1.4 Keywords

The following words are reserved keywords:

```
fn       let      type     actor     contract   server
component  state  on       match     if         else
for      in       return   reply     spawn      deploy
emit     pub      use      mod       own        shared
scope    parallel supervise init     with       pure
async    await    true     false     mut        while
enum
```

`true` and `false` are lexed as `BoolLiteral` tokens rather than keyword
tokens. All other keywords produce their corresponding keyword token type.

### 1.5 Integer Literals

```
DecimalDigit = "0".."9" ;
HexDigit     = DecimalDigit | "a".."f" | "A".."F" ;
BinaryDigit  = "0" | "1" ;

DecimalLiteral = DecimalDigit , { DecimalDigit | "_" } ;
HexLiteral     = "0" , ( "x" | "X" ) , { HexDigit | "_" } ;
BinaryLiteral  = "0" , ( "b" | "B" ) , { BinaryDigit | "_" } ;

IntLiteral = HexLiteral | BinaryLiteral | DecimalLiteral ;
```

Underscores may appear between digits as visual separators (e.g., `1_000_000`).

**Examples:** `42`, `0xFF`, `0b1010`, `1_000_000`

### 1.6 Float Literals

```
FloatLiteral = DecimalLiteral , "." , { DecimalDigit | "_" }
             , [ ( "e" | "E" ) , [ "+" | "-" ] , { DecimalDigit } ]
             | DecimalLiteral , ( "e" | "E" ) , [ "+" | "-" ] , { DecimalDigit } ;
```

A number becomes a float if it contains a decimal point (when the next
character after `.` is not another `.`, to avoid conflict with range `..`)
or scientific notation.

**Examples:** `3.14`, `1.0e10`, `2.5E-3`, `1_000.0`

### 1.7 String Literals

```
EscapeSequence = "\" , ( "n" | "t" | "r" | "\" | '"' | "{" ) ;
StringChar     = ANY except '"' and "\" | EscapeSequence ;
StringLiteral  = '"' , { StringChar } , '"' ;
```

Supported escape sequences:

| Escape | Character      |
|--------|----------------|
| `\n`   | Newline        |
| `\t`   | Tab            |
| `\r`   | Carriage return|
| `\\`   | Backslash      |
| `\"`   | Double quote   |
| `\{`   | Literal brace  |

An unrecognized escape `\X` is emitted as the two-character sequence `\X`.

### 1.8 Boolean Literals

```
BoolLiteral = "true" | "false" ;
```

These are recognized by the keyword lookup and emitted as `BoolLiteral` tokens.

### 1.9 Annotations

```
Annotation = "#[" , { ANY except "]" | Annotation } , "]" ;
```

Annotation brackets nest: `#[outer(#[inner])]` is valid. The full text
including `#[` and `]` is captured as a single `Annotation` token. The parser
then splits the inner text into a name and optional parenthesized arguments.

**Examples:** `#[intent("description")]`, `#[pre(x > 0)]`, `#[get("/users")]`

### 1.10 Operators and Punctuation

Single-character tokens:

| Token | Symbol |
|-------|--------|
| `(`   | LeftParen |
| `)`   | RightParen |
| `{`   | LeftBrace |
| `}`   | RightBrace |
| `[`   | LeftBracket |
| `]`   | RightBracket |
| `,`   | Comma |
| `;`   | Semicolon |
| `%`   | Percent |
| `#`   | Hash (when not followed by `[`) |

Multi-character and ambiguous tokens (resolved by lookahead):

| Token  | Symbol     | Notes                         |
|--------|------------|-------------------------------|
| `+`    | Plus       |                               |
| `+=`   | PlusAssign |                               |
| `-`    | Minus      |                               |
| `-=`   | MinusAssign|                               |
| `->`   | Arrow      | Return type annotation        |
| `*`    | Star       |                               |
| `/`    | Slash      | When not followed by `/` or `*` |
| `=`    | Assign     |                               |
| `==`   | Eq         |                               |
| `=>`   | FatArrow   | Match arm separator           |
| `!`    | Not        |                               |
| `!=`   | NotEq      |                               |
| `<`    | Lt         |                               |
| `<=`   | LtEq       |                               |
| `>`    | Gt         |                               |
| `>=`   | GtEq       |                               |
| `&`    | Ampersand  | Reference type prefix         |
| `&&`   | And        | Logical and                   |
| `\|`   | Pipe       | Union type / pattern separator|
| `\|\|` | Or         | Logical or                    |
| `:`    | Colon      |                               |
| `::`   | ColonColon | Path separator                |
| `.`    | Dot        | Field access / method call    |
| `..`   | DotDot     | Exclusive range               |
| `..=`  | DotDotEq   | Inclusive range               |

---

## 2. Syntax Grammar

All productions below operate on the filtered token stream (no comment or
newline tokens).

### 2.1 Program

```
Program = { TopLevelItem } ;
```

A program is a sequence of zero or more top-level items, followed by EOF.

### 2.2 Top-Level Items

```
TopLevelItem = { Annotation } , [ Visibility ] , Declaration ;

Declaration = FunctionDecl
            | TypeDecl
            | ActorDecl
            | ContractDecl
            | ServerDecl
            | ComponentDecl
            | UseDecl
            | ModDecl
            | StateDecl ;
```

The parser peeks at the next token after consuming annotations and visibility
to decide which declaration form to parse.

### 2.3 Annotations

```
Annotations = { Annotation } ;
```

Each `Annotation` token is parsed by extracting the content between `#[` and
`]`. If the content contains `(`, it is split into a name and parenthesized
argument string:

```
(* Parsed from the Annotation token's text: *)
AnnotationInner = AnnotationName , [ "(" , AnnotationArgs , ")" ] ;
AnnotationName  = (* text before first '(' *) ;
AnnotationArgs  = (* text between '(' and final ')' *) ;
```

**Example:** `#[intent("Transfer tokens safely")]` produces name=`intent`,
args=`"Transfer tokens safely"`.

### 2.4 Visibility

```
Visibility = "pub" , [ "(" , "pkg" , ")" ]
           | (* empty -- private *) ;
```

- `pub` -- public visibility
- `pub(pkg)` -- package-scoped visibility
- (absent) -- private visibility

Note: `pkg` is matched as an identifier with value `"pkg"`, not as a keyword.

### 2.5 Function Declaration

```
FunctionDecl = [ "pure" ] , [ "async" ] , "fn" , Ident ,
               "(" , ParamList , ")" ,
               [ "->" , TypeExpr ] ,
               [ "with" , EffectList ] ,
               Block ;

ParamList = [ Parameter , { "," , Parameter } , [ "," ] ] ;

Parameter = Ident , ":" , [ Ownership ] , TypeExpr ;

Ownership = "own"
          | "shared"
          | "&" , [ "mut" ] ;

EffectList = IdentOrType , { "," , IdentOrType } ;
```

The `pure` and `async` modifiers are optional and must appear before `fn` in
that order (pure first, async second).

The return type follows `->`. When parsing the return type, refinement types
(types followed by `{`) are disabled to avoid ambiguity with the function body
block.

Effects are declared after `with` as a comma-separated list of names.

**Example:**

```
#[intent("Fetch user by ID")]
pub async fn get_user(id: UserId) -> Result<User, ApiError> with Database {
    db.find::<User>(id)
}
```

### 2.6 Type Declaration

```
TypeDecl = "type" , IdentOrType , [ TypeParams ] , TypeDeclBody ;

TypeDeclBody = "=" , TypeExpr                     (* type alias *)
             | "{" , FieldDeclList , "}" ;         (* struct type *)

TypeParams = "<" , TypeParam , { "," , TypeParam } , ">" ;

TypeParam = IdentOrType ;

FieldDeclList = [ FieldDecl , { [ "," ] , FieldDecl } , [ "," ] ] ;

FieldDecl = Ident , ":" , TypeExpr , [ "=" , Expr ] ;
```

**Type alias examples:**

```
type UserId = UUID
type Email = String{matches: r"^[^@]+@[^@]+$"}
type Role = Admin | Editor | Viewer
type ApiError = NotFound(String) | Unauthorized | ValidationError(Vec<String>)
```

**Struct type examples:**

```
type User {
    id: UserId,
    name: String{len: 1..100},
    email: Email,
    role: Role,
}
```

Note: The union type (`A | B | C`) is expressed as a `TypeExpr` on the
right-hand side of `=`, using the union type production. Enum variants with
payloads (e.g., `NotFound(String)`) are expressed in the type expression
grammar rather than through a separate enum declaration syntax.

### 2.7 Actor Declaration

```
ActorDecl = "actor" , IdentOrType , "{" , { ActorMember } , "}" ;

ActorMember = StateDecl
            | OnHandler
            | FunctionDecl     (* with optional annotations and visibility *)
            | SuperviseDecl
            | InitDecl ;
```

Actor members may be preceded by annotations and visibility modifiers (which
are consumed before dispatching to `FunctionDecl`).

**Example:**

```
actor ChatRoom {
    state members: Map<UserId, UserActor>
    state history: Vec<Message>{len: ..1000}

    on Join(user_id: UserId, name: String) {
        let user_actor = spawn UserActor(user_id, name, self);
        members.insert(user_id, user_actor);
    }

    on GetMembers() -> Vec<UserId> {
        reply members.keys().collect();
    }

    fn broadcast(msg: Message) {
        for (_, member) in members {
            member.send(Deliver(msg.clone()));
        }
    }

    supervise UserActor {
        restart: .never,
        on_failure: |failed_actor| {
            self.send(Leave(failed_actor.user_id));
        }
    }
}
```

### 2.8 State Declaration

```
StateDecl = "state" , Ident , ":" , TypeExpr , [ "=" , Expr ] ;
```

State declarations can appear at the top level, inside actors, inside
contracts, and inside servers.

**Examples:**

```
state total_supply: u256
state balances: Map<Address, u256>
state current_user: Option<User> = None
state name: String = "C! Demo Token"
```

### 2.9 On Handler (Actor Message Handler)

```
OnHandler = "on" , IdentOrType ,
            "(" , ParamList , ")" ,
            [ "->" , TypeExpr ] ,
            Block ;
```

The return type arrow uses the same refinement-disabled parsing as function
declarations.

**Examples:**

```
on Join(user_id: UserId, name: String) {
    members.insert(user_id, client);
}

on GetMembers() -> Vec<UserId> {
    reply members.keys().collect();
}
```

### 2.10 Supervise Declaration

```
SuperviseDecl = "supervise" , IdentOrType ,
                "{" , { SuperviseOption , [ "," ] } , "}" ;

SuperviseOption = Ident , ":" , Expr ;
```

**Example:**

```
supervise ChatRoom { restart: .always, max_restarts: 10 per .minute }
```

### 2.11 Init Declaration

```
InitDecl = "init" , "(" , ParamList , ")" , Block ;
```

Appears in actors and contracts to define initialization logic.

**Example:**

```
init(initial_supply: u256{1..MAX_U256}) {
    total_supply = initial_supply;
    balances[caller] = total_supply;
}
```

### 2.12 Contract Declaration

```
ContractDecl = "contract" , IdentOrType ,
               [ ":" , InterfaceList ] ,
               "{" , { ContractMember } , "}" ;

InterfaceList = IdentOrType , { "," , IdentOrType } ;

ContractMember = StateDecl
               | FunctionDecl    (* with optional annotations and visibility *)
               | InitDecl ;
```

**Example:**

```
contract DemoToken : ERC20 {
    state total_supply: u256
    state balances: Map<Address, u256>

    init(initial_supply: u256) {
        total_supply = initial_supply;
    }

    pub fn transfer(to: Address, amount: u256) -> Result<bool> {
        // ...
    }

    pub pure fn balance_of(account: Address) -> u256 {
        balances[account]
    }
}
```

### 2.13 Server Declaration

```
ServerDecl = "server" , IdentOrType , "{" , { ServerMember } , "}" ;

ServerMember = FunctionDecl      (* with optional annotations and visibility *)
             | StateDecl
             | FieldAssignment ;

FieldAssignment = Ident , ":" , Expr ;
```

Server members first try to parse as a function or state declaration. If the
current token is an identifier followed by `:`, it is parsed as a field
assignment (configuration).

**Example:**

```
server App {
    bind: "0.0.0.0:8080"

    #[get("/users/:id")]
    fn get_user(id: UserId) -> Result<User, ApiError> with Database {
        db.find::<User>(id)
    }
}
```

### 2.14 Component Declaration

```
ComponentDecl = "component" , IdentOrType ,
                "(" , ParamList , ")" ,
                Block ;
```

Components are parameterized UI elements.

Note: The parser does not support a zero-parameter component form without
parentheses. The component body is parsed as a regular block. Template syntax
(HTML-like tags, JSX) within the block body is not parsed by the current
parser; it is handled downstream.

**Example:**

```
component UserProfile(user: User) {
    // Component body
}
```

### 2.15 Use Declaration

```
UseDecl = "use" , UsePath ;

UsePath = PathSegment , { "::" , PathSegment } , UseTerminator ;

UseTerminator = "::" , "*"                                    (* wildcard import *)
              | "::" , "{" , UseItemList , "}"                (* selective import *)
              | (* empty -- single item import *) ;

UseItemList = UseItem , { "," , UseItem } , [ "," ] ;

UseItem = PathSegment , [ "as" , PathSegment ] ;

PathSegment = Ident | TypeIdent
            | "shared" | "state" | "type" | "mod"
            | "server" | "actor" | "contract" ;
```

For a single-item import (no braces, no wildcard), the last segment of the
path becomes the imported name and the preceding segments form the module path.

An optional trailing semicolon is consumed if present.

**Examples:**

```
use std::collections::HashMap
use std::io::*
use crypto::{sha256, hmac as hmac_sign}
use mylib::MyType;
```

### 2.16 Module Declaration

```
ModDecl = "mod" , Ident , ModBody ;

ModBody = "{" , { TopLevelItem } , "}"    (* inline module *)
        | [ ";" ] ;                        (* external module file *)
```

**Examples:**

```
mod auth;

mod helpers {
    fn slugify(text: String) -> String { /* ... */ }
}
```

---

## 3. Type Expressions

```
TypeExpr = PrimaryType , [ { "|" , PrimaryType } ] ;
```

When the first `PrimaryType` is followed by `|`, the result is a `UnionType`
containing all alternatives.

### 3.1 Primary Types

```
PrimaryType = ReferenceType
            | OwnedType
            | SharedType
            | NamedOrGenericType
            | ParenthesizedType ;

ReferenceType = "&" , [ "mut" ] , PrimaryType ;

OwnedType = "own" , PrimaryType ;

SharedType = "shared" , PrimaryType ;
```

### 3.2 Named and Generic Types

```
NamedOrGenericType = ( TypeIdent | Ident ) , [ GenericArgs ] , [ RefinementSuffix ] ;

GenericArgs = "<" , TypeExpr , { "," , TypeExpr } , ">" ;
```

A bare name without generic arguments produces a `NamedType`. A name with
`<...>` produces a `GenericType`.

**Examples:**

```
i32
String
Vec<Todo>
Map<String, Vec<u8>>
Result<User, ApiError>
```

### 3.3 Refined Types

```
RefinementSuffix = "{" , RefinementConstraint , { "," , RefinementConstraint } , [ "," ] , "}" ;

RefinementConstraint = Ident , ":" , Expr       (* named constraint *)
                     | Expr ;                    (* positional constraint *)
```

Refinement is only parsed when `allowRefinement` is true. It is disabled when
parsing function/handler return types to avoid ambiguity with the body block.

A named constraint has the form `name: value`. A positional constraint is a
bare expression (commonly a range).

**Examples:**

```
u16{1..65535}
String{len: 1..100}
String{len: 1..50, matches: r"^[a-zA-Z0-9_]+$"}
f64{0.0..=100.0}
Vec<Message>{len: ..1000}
u256{1..MAX_U256}
```

### 3.4 Parenthesized Types and Unit Type

```
ParenthesizedType = "(" , [ TypeExpr ] , ")" ;
```

An empty `()` produces a `NamedType` with name `"()"` (the unit type). A
non-empty parenthesized form is just grouping for precedence.

---

## 4. Statements

```
Block = "{" , { Statement } , "}" ;

Statement = LetStmt
          | ReturnStmt
          | ReplyStmt
          | EmitStmt
          | ForStmt
          | IfStmt
          | MatchStmt
          | SpawnStmt
          | ExprOrAssignStmt ;
```

### 4.1 Let Statement

```
LetStmt = "let" , [ "mut" ] , Ident ,
          [ ":" , TypeExpr ] ,
          "=" , Expr , [ ";" ] ;
```

**Examples:**

```
let name = "World"
let mut count: i32 = 0
let port: u16{1..65535} = 8080;
```

### 4.2 Return Statement

```
ReturnStmt = "return" , [ Expr ] , [ ";" ] ;
```

The expression is omitted only if the next token is `;` or `}`.

### 4.3 Reply Statement

```
ReplyStmt = "reply" , Expr , [ ";" ] ;
```

Used inside `on` handlers to send a response.

### 4.4 Emit Statement

```
EmitStmt = "emit" , IdentOrType ,
           "(" , [ Expr , { "," , Expr } ] , ")" , [ ";" ] ;
```

**Example:**

```
emit Transfer(caller, to, amount);
```

### 4.5 For Statement

```
ForStmt = "for" , Ident , "in" , Expr , Block ;
```

**Example:**

```
for msg in history {
    client.send(Deliver(msg));
}
```

### 4.6 If Statement

```
IfStmt = "if" , Expr , Block , [ ElseClause ] ;

ElseClause = "else" , ( IfStmt | Block ) ;
```

Chained `else if` is supported by parsing the else branch as another `IfStmt`.

**Example:**

```
if x > 0 {
    print("positive");
} else if x == 0 {
    print("zero");
} else {
    print("negative");
}
```

### 4.7 Match Statement

```
MatchStmt = "match" , Expr , "{" , { MatchArm , [ "," ] } , "}" ;

MatchArm = Pattern , "=>" , ( Block | Expr ) ;
```

**Example:**

```
match result {
    Ok(value) => print("Got: {value}"),
    Err(msg)  => print("Error: {msg}"),
}
```

### 4.8 Spawn Statement

```
SpawnStmt = "spawn" , IdentOrType ,
            [ "(" , [ Expr , { "," , Expr } ] , ")" ] , [ ";" ] ;
```

The parenthesized argument list is optional. If no `(` follows the actor name,
it is a bare spawn with no arguments.

**Examples:**

```
spawn Application()
spawn UserActor(user_id, name, self)
let room = spawn ChatRoom();
```

### 4.9 Expression Statement and Assignment

```
ExprOrAssignStmt = Expr , [ AssignOp , Expr ] , [ ";" ] ;

AssignOp = "=" | "+=" | "-=" ;
```

If an assignment operator follows the initial expression, the statement becomes
an `AssignStmt`. Otherwise it is an `ExprStmt`.

**Examples:**

```
print("hello");
balances[caller] -= amount;
total_supply += amount;
x = 42;
```

---

## 5. Expressions

Expressions are parsed using Pratt (precedence-climbing) parsing.

### 5.1 Precedence Table

From lowest to highest precedence:

| Precedence | Operators          | Associativity | Description           |
|------------|--------------------|---------------|-----------------------|
| 1          | `\|\|`             | Left          | Logical or            |
| 2          | `&&`               | Left          | Logical and           |
| 3          | `==` , `!=`        | Left          | Equality              |
| 4          | `<` , `>` , `<=` , `>=` | Left     | Comparison            |
| 5          | `..` , `..=`       | Left          | Range                 |
| 6          | `+` , `-`          | Left          | Addition, subtraction |
| 7          | `*` , `/` , `%`    | Left          | Multiplication, division, remainder |
| 8          | `!` , `-` (prefix) | Right (unary) | Logical not, negation |
| 9          | `.` , `()` , `[]`  | Left (postfix)| Access, call, index   |

### 5.2 Binary Expressions

```
BinaryExpr = UnaryExpr , { BinaryOp , UnaryExpr } ;

BinaryOp = "||" | "&&"
         | "==" | "!="
         | "<"  | ">"  | "<=" | ">="
         | "+"  | "-"
         | "*"  | "/"  | "%" ;
```

### 5.3 Range Expressions

```
RangeExpr = Expr , ( ".." | "..=" ) , [ Expr ] ;
```

Range operators are parsed at precedence level 5. The right-hand side is
optional: `1..` is a valid half-open range. The parser stops parsing the
right side when it encounters `}`, `)`, `,`, or `;`.

**Examples:**

```
1..100
0..=255
1..
..1000
```

### 5.4 Unary Expressions

```
UnaryExpr = ( "!" | "-" ) , UnaryExpr
          | PostfixExpr ;
```

### 5.5 Postfix Expressions

```
PostfixExpr = PrimaryExpr , { PostfixOp } ;

PostfixOp = "." , IdentOrType , [ "(" , CallArgList , ")" ]   (* field access or method call *)
          | "[" , Expr , "]"                                    (* index *)
          | "(" , CallArgList , ")"                             (* function call -- only when callee is Ident or Path *) ;
```

Function calls via `(` are only parsed as postfix when the left-hand
expression is an `Ident` or `Path` node. This prevents ambiguity with other
constructs.

**Examples:**

```
user.name                          (* field access *)
list.push(item)                    (* method call *)
items[0]                           (* index access *)
print("hello")                     (* function call *)
db.find::<User>(id)                (* method call *)
db.query::<Todo>().filter(f).all() (* chained method calls *)
```

### 5.6 Primary Expressions

```
PrimaryExpr = IntLiteral
            | FloatLiteral
            | StringLiteral
            | BoolLiteral
            | DeployExpr
            | MacroCallExpr
            | TypeIdentExpr
            | IdentExpr
            | ParenExpr
            | BlockExpr
            | ParallelExpr
            | ScopeExpr ;
```

#### 5.6.1 Literals

```
IntLiteralExpr    = INT_LITERAL ;
FloatLiteralExpr  = FLOAT_LITERAL ;
StringLiteralExpr = STRING_LITERAL ;
BoolLiteralExpr   = BOOL_LITERAL ;
```

#### 5.6.2 Deploy Expression

```
DeployExpr = "deploy" , IdentOrType ,
             "(" , CallArgList , ")" ;
```

The deploy expression is parsed as a `Call` node with a synthetic callee
`deploy ContractName`.

**Example:**

```
let token = deploy DemoToken(initial_supply: 1_000_000);
```

#### 5.6.3 Macro Call Expression

```
MacroCallExpr = Ident , "!" , "(" , [ Expr , { "," , Expr } ] , ")" ;
```

A macro call is recognized when an `Identifier` is immediately followed by
`!`. The `!` is consumed, then a parenthesized argument list is parsed.

**Examples:**

```
verify!(to != Address::zero(), "Cannot transfer to zero address")
format!("Hello, {name}!")
```

#### 5.6.4 Type Identifier Expressions

When a `TypeIdentifier` is encountered as a primary expression, the parser
checks what follows:

```
TypeIdentExpr = TypeIdent , TypeIdentSuffix ;

TypeIdentSuffix = "::" , PathTail                 (* path expression *)
               | "(" , CallArgList , ")"           (* constructor call *)
               | "{" , StructFieldList , "}"        (* struct literal *)
               | (* empty -- bare identifier *) ;

PathTail = IdentOrType , { "::" , IdentOrType } ,
           [ "(" , CallArgList , ")" ] ;           (* optional call at end of path *)
```

**Examples:**

```
Ok(42)                                (* constructor call *)
Some(value)                           (* constructor call *)
None                                  (* bare type identifier *)
Address::zero()                       (* path + call *)
DateTime::now()                       (* path + call *)
Todo { id: id, title: title }         (* struct literal *)
```

#### 5.6.5 Identifier Expressions

When an `Identifier` is encountered as a primary expression:

```
IdentExpr = Ident , [ "::" , PathTail ] ;

PathTail = IdentOrType , { "::" , IdentOrType } ,
           [ "(" , CallArgList , ")" ] ;
```

**Examples:**

```
x
std::io::read()
crypto::sha256(data)
```

#### 5.6.6 Parenthesized Expression

```
ParenExpr = "(" , [ Expr ] , ")" ;
```

An empty `()` produces an `Ident` node with name `"()"` (the unit value).

#### 5.6.7 Block Expression

```
BlockExpr = Block ;
```

A bare `{...}` in expression position is parsed as a block expression.

#### 5.6.8 Parallel Expression

```
ParallelExpr = "parallel" , Block ;
```

**Example:**

```
parallel {
    fetch_users()
    fetch_posts()
}
```

#### 5.6.9 Scope Expression

```
ScopeExpr = "scope" , Ident , "=" , Expr , Block ;
```

Introduces a scoped resource with deterministic cleanup.

**Example:**

```
scope data = load_data() {
    process(&data);
}
```

### 5.7 Struct Literals

```
StructExpr = TypeIdent , "{" , StructFieldList , "}" ;

StructFieldList = [ StructField , { "," , StructField } , [ "," ] ] ;

StructField = Ident , ":" , Expr ;
```

**Example:**

```
let msg = Message {
    from: sender,
    text: "Hello",
    timestamp: now(),
};
```

### 5.8 Path Expressions

```
PathExpr = ( Ident | TypeIdent ) , "::" , IdentOrType ,
           { "::" , IdentOrType } ;
```

Paths use `::` as the separator. They can end with a call `()` (handled by
postfix parsing) or stand alone.

**Examples:**

```
std::collections::HashMap
Address::zero
TodoFilter::All
```

### 5.9 Call Arguments

```
CallArgList = [ CallArg , { "," , CallArg } , [ "," ] ] ;

CallArg = Ident , ":" , Expr      (* named argument *)
        | Expr ;                   (* positional argument *)
```

Named arguments are recognized when an `Identifier` is immediately followed by
`:` (lookahead of 1). Arguments can be mixed positional and named.

**Examples:**

```
print("hello")
spawn WebSocketServer(port: 8080, room: room)
deploy DemoToken(initial_supply: 1_000_000)
```

---

## 6. Patterns

Patterns appear in `match` arms.

```
Pattern = WildcardPattern
        | LiteralPattern
        | ConstructorPattern
        | IdentPattern ;

WildcardPattern = "_" ;

LiteralPattern = INT_LITERAL
               | STRING_LITERAL
               | BOOL_LITERAL ;

ConstructorPattern = ( TypeIdent | Ident ) , [ "(" , PatternList , ")" ] ;

PatternList = [ Pattern , { "," , Pattern } ] ;

IdentPattern = Ident ;
```

Classification rules:

1. An identifier with value `_` is a `WildcardPattern`.
2. Integer, string, and boolean literals are `LiteralPattern`.
3. A `TypeIdentifier` or `Identifier` followed by `(` is a `ConstructorPattern`
   with fields.
4. A `TypeIdentifier` (or an `Identifier` starting with uppercase) not followed
   by `(` is a `ConstructorPattern` with zero fields (e.g., `None`, `Unauthorized`).
5. Any other `Identifier` is an `IdentPattern` (variable binding).

**Examples:**

```
match value {
    Ok(x)     => handle(x),       (* constructor with binding *)
    Err(msg)  => log(msg),        (* constructor with binding *)
    None      => default(),       (* nullary constructor *)
    _         => fallback(),      (* wildcard *)
}

match count {
    0     => "none",              (* integer literal *)
    1     => "one",               (* integer literal *)
    n     => format!("{n}"),      (* identifier binding *)
}
```

---

## 7. Identifier Helper Rules

The parser uses several helper functions to accept identifiers in different
contexts:

```
Ident       = IDENTIFIER ;                          (* lowercase/underscore-prefixed *)

TypeIdent   = TYPE_IDENTIFIER ;                     (* PascalCase *)

IdentOrType = IDENTIFIER | TYPE_IDENTIFIER ;        (* either form *)

PathSegment = IDENTIFIER | TYPE_IDENTIFIER
            | "shared" | "state" | "type" | "mod"
            | "server" | "actor" | "contract" ;     (* keywords valid in paths *)
```

`IdentOrType` is used for names that may be either lowercase or PascalCase,
such as type names, actor names, effect names, event names, and message names.

`PathSegment` extends `IdentOrType` to also accept certain keywords that may
appear as module path segments in `use` declarations.

---

## 8. Semicolons

Semicolons are optional in most contexts. The parser calls `match(Semicolon)`
(consuming a semicolon if present, ignoring if absent) after:

- `let` statements
- `return` statements
- `reply` statements
- `emit` statements
- `spawn` statements
- expression statements
- assignment statements
- `use` declarations
- `mod` declarations (external module form)

Semicolons are **not** used after block-bodied constructs (`fn`, `if`, `for`,
`match`, `actor`, `server`, etc.).

---

## 9. Error Recovery

When the parser encounters an unexpected token at the top level, it
synchronizes by advancing until it finds a token that could begin a new
top-level item:

```
SyncTokens = "fn" | "type" | "actor" | "contract" | "server"
           | "component" | "use" | "mod" | "pub" | ANNOTATION ;
```

This allows the parser to continue and report multiple errors in a single pass.

---

## 10. Complete Grammar Summary

For reference, here is the full grammar in compact form:

```ebnf
(* === Program === *)
Program          = { TopLevelItem } , EOF ;

TopLevelItem     = { Annotation } , [ Visibility ] , Declaration ;

Declaration      = FunctionDecl | TypeDecl | ActorDecl | ContractDecl
                 | ServerDecl | ComponentDecl | UseDecl | ModDecl | StateDecl ;

(* === Annotations and Visibility === *)
Annotation       = "#[" , AnnotationContent , "]" ;
Visibility       = "pub" , [ "(" , "pkg" , ")" ] | (* empty *) ;

(* === Declarations === *)
FunctionDecl     = [ "pure" ] , [ "async" ] , "fn" , Ident ,
                   "(" , ParamList , ")" ,
                   [ "->" , TypeExpr ] ,
                   [ "with" , EffectList ] ,
                   Block ;

TypeDecl         = "type" , IdentOrType , [ TypeParams ] ,
                   ( "=" , TypeExpr | "{" , FieldDeclList , "}" ) ;

ActorDecl        = "actor" , IdentOrType , "{" , { ActorMember } , "}" ;
ActorMember      = StateDecl | OnHandler | FunctionDecl | SuperviseDecl | InitDecl ;

ContractDecl     = "contract" , IdentOrType , [ ":" , InterfaceList ] ,
                   "{" , { ContractMember } , "}" ;
ContractMember   = StateDecl | FunctionDecl | InitDecl ;

ServerDecl       = "server" , IdentOrType , "{" , { ServerMember } , "}" ;
ServerMember     = FunctionDecl | StateDecl | FieldAssignment ;

ComponentDecl    = "component" , IdentOrType , "(" , ParamList , ")" , Block ;

UseDecl          = "use" , PathSegment , { "::" , PathSegment } ,
                   [ "::" , ( "*" | "{" , UseItemList , "}" ) ] , [ ";" ] ;

ModDecl          = "mod" , Ident , ( "{" , { TopLevelItem } , "}" | [ ";" ] ) ;

StateDecl        = "state" , Ident , ":" , TypeExpr , [ "=" , Expr ] ;
OnHandler        = "on" , IdentOrType , "(" , ParamList , ")" ,
                   [ "->" , TypeExpr ] , Block ;
SuperviseDecl    = "supervise" , IdentOrType ,
                   "{" , { Ident , ":" , Expr , [ "," ] } , "}" ;
InitDecl         = "init" , "(" , ParamList , ")" , Block ;

FieldAssignment  = Ident , ":" , Expr ;

(* === Parameters === *)
ParamList        = [ Parameter , { "," , Parameter } , [ "," ] ] ;
Parameter        = Ident , ":" , [ Ownership ] , TypeExpr ;
Ownership        = "own" | "shared" | "&" , [ "mut" ] ;

TypeParams       = "<" , IdentOrType , { "," , IdentOrType } , ">" ;
FieldDeclList    = [ FieldDecl , { [ "," ] , FieldDecl } , [ "," ] ] ;
FieldDecl        = Ident , ":" , TypeExpr , [ "=" , Expr ] ;
InterfaceList    = IdentOrType , { "," , IdentOrType } ;
EffectList       = IdentOrType , { "," , IdentOrType } ;
UseItemList      = UseItem , { "," , UseItem } , [ "," ] ;
UseItem          = PathSegment , [ "as" , PathSegment ] ;

(* === Type Expressions === *)
TypeExpr         = PrimaryType , { "|" , PrimaryType } ;

PrimaryType      = "&" , [ "mut" ] , PrimaryType
                 | "own" , PrimaryType
                 | "shared" , PrimaryType
                 | ( TypeIdent | Ident ) , [ "<" , TypeExpr , { "," , TypeExpr } , ">" ]
                   , [ "{" , RefinementList , "}" ]
                 | "(" , [ TypeExpr ] , ")" ;

RefinementList   = RefinementConstraint , { "," , RefinementConstraint } , [ "," ] ;
RefinementConstraint = Ident , ":" , Expr | Expr ;

(* === Statements === *)
Block            = "{" , { Statement } , "}" ;

Statement        = "let" , [ "mut" ] , Ident , [ ":" , TypeExpr ] , "=" , Expr , [ ";" ]
                 | "return" , [ Expr ] , [ ";" ]
                 | "reply" , Expr , [ ";" ]
                 | "emit" , IdentOrType , "(" , ExprList , ")" , [ ";" ]
                 | "for" , Ident , "in" , Expr , Block
                 | "if" , Expr , Block , [ "else" , ( IfStmt | Block ) ]
                 | "match" , Expr , "{" , { MatchArm , [ "," ] } , "}"
                 | "spawn" , IdentOrType , [ "(" , ExprList , ")" ] , [ ";" ]
                 | Expr , [ ( "=" | "+=" | "-=" ) , Expr ] , [ ";" ] ;

MatchArm         = Pattern , "=>" , ( Block | Expr ) ;

(* === Patterns === *)
Pattern          = "_"
                 | INT_LITERAL | STRING_LITERAL | BOOL_LITERAL
                 | ( TypeIdent | Ident ) , [ "(" , PatternList , ")" ]
                 | Ident ;

PatternList      = [ Pattern , { "," , Pattern } ] ;

(* === Expressions === *)
Expr             = BinaryExpr ;
BinaryExpr       = UnaryExpr , { BinaryOp , UnaryExpr } ;
BinaryOp         = "||" | "&&" | "==" | "!=" | "<" | ">" | "<=" | ">="
                 | ".." | "..=" | "+" | "-" | "*" | "/" | "%" ;

UnaryExpr        = ( "!" | "-" ) , UnaryExpr | PostfixExpr ;

PostfixExpr      = PrimaryExpr , { "." , IdentOrType , [ "(" , CallArgList , ")" ]
                                  | "[" , Expr , "]"
                                  | "(" , CallArgList , ")" } ;

PrimaryExpr      = INT_LITERAL | FLOAT_LITERAL | STRING_LITERAL | BOOL_LITERAL
                 | "deploy" , IdentOrType , "(" , CallArgList , ")"
                 | Ident , "!" , "(" , ExprList , ")"
                 | TypeIdent , ( "::" , PathTail | "(" , CallArgList , ")"
                               | "{" , StructFieldList , "}" | (* empty *) )
                 | Ident , [ "::" , PathTail ]
                 | "(" , [ Expr ] , ")"
                 | Block
                 | "parallel" , Block
                 | "scope" , Ident , "=" , Expr , Block ;

PathTail         = IdentOrType , { "::" , IdentOrType } , [ "(" , CallArgList , ")" ] ;

CallArgList      = [ CallArg , { "," , CallArg } , [ "," ] ] ;
CallArg          = Ident , ":" , Expr | Expr ;
ExprList         = [ Expr , { "," , Expr } ] ;
StructFieldList  = [ StructField , { "," , StructField } , [ "," ] ] ;
StructField      = Ident , ":" , Expr ;

(* === Identifiers === *)
Ident            = IDENTIFIER ;
TypeIdent        = TYPE_IDENTIFIER ;
IdentOrType      = IDENTIFIER | TYPE_IDENTIFIER ;
PathSegment      = IdentOrType | "shared" | "state" | "type" | "mod"
                 | "server" | "actor" | "contract" ;
```
