"use strict";
var CBang = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    Checker: () => Checker,
    JsGenerator: () => JsGenerator,
    Lexer: () => Lexer,
    Parser: () => Parser,
    Resolver: () => Resolver,
    SymbolTable: () => SymbolTable,
    TokenType: () => TokenType,
    VERSION: () => VERSION,
    createError: () => createError,
    createWarning: () => createWarning,
    formatDiagnostic: () => formatDiagnostic
  });

  // src/lexer/token.ts
  var TokenType = /* @__PURE__ */ ((TokenType2) => {
    TokenType2["IntLiteral"] = "IntLiteral";
    TokenType2["FloatLiteral"] = "FloatLiteral";
    TokenType2["StringLiteral"] = "StringLiteral";
    TokenType2["BoolLiteral"] = "BoolLiteral";
    TokenType2["Identifier"] = "Identifier";
    TokenType2["TypeIdentifier"] = "TypeIdentifier";
    TokenType2["Fn"] = "fn";
    TokenType2["Let"] = "let";
    TokenType2["Type"] = "type";
    TokenType2["Actor"] = "actor";
    TokenType2["Contract"] = "contract";
    TokenType2["Server"] = "server";
    TokenType2["Component"] = "component";
    TokenType2["State"] = "state";
    TokenType2["On"] = "on";
    TokenType2["Match"] = "match";
    TokenType2["If"] = "if";
    TokenType2["Else"] = "else";
    TokenType2["For"] = "for";
    TokenType2["In"] = "in";
    TokenType2["Return"] = "return";
    TokenType2["Reply"] = "reply";
    TokenType2["Spawn"] = "spawn";
    TokenType2["Deploy"] = "deploy";
    TokenType2["Emit"] = "emit";
    TokenType2["Pub"] = "pub";
    TokenType2["Use"] = "use";
    TokenType2["Mod"] = "mod";
    TokenType2["Own"] = "own";
    TokenType2["Shared"] = "shared";
    TokenType2["Scope"] = "scope";
    TokenType2["Parallel"] = "parallel";
    TokenType2["Supervise"] = "supervise";
    TokenType2["Init"] = "init";
    TokenType2["With"] = "with";
    TokenType2["Pure"] = "pure";
    TokenType2["Async"] = "async";
    TokenType2["Await"] = "await";
    TokenType2["True"] = "true";
    TokenType2["False"] = "false";
    TokenType2["Mut"] = "mut";
    TokenType2["While"] = "while";
    TokenType2["Enum"] = "enum";
    TokenType2["Plus"] = "+";
    TokenType2["Minus"] = "-";
    TokenType2["Star"] = "*";
    TokenType2["Slash"] = "/";
    TokenType2["Percent"] = "%";
    TokenType2["Eq"] = "==";
    TokenType2["NotEq"] = "!=";
    TokenType2["Lt"] = "<";
    TokenType2["Gt"] = ">";
    TokenType2["LtEq"] = "<=";
    TokenType2["GtEq"] = ">=";
    TokenType2["And"] = "&&";
    TokenType2["Or"] = "||";
    TokenType2["Not"] = "!";
    TokenType2["Assign"] = "=";
    TokenType2["PlusAssign"] = "+=";
    TokenType2["MinusAssign"] = "-=";
    TokenType2["Arrow"] = "->";
    TokenType2["FatArrow"] = "=>";
    TokenType2["ColonColon"] = "::";
    TokenType2["Dot"] = ".";
    TokenType2["DotDot"] = "..";
    TokenType2["DotDotEq"] = "..=";
    TokenType2["Pipe"] = "|";
    TokenType2["Ampersand"] = "&";
    TokenType2["Hash"] = "#";
    TokenType2["LeftParen"] = "(";
    TokenType2["RightParen"] = ")";
    TokenType2["LeftBrace"] = "{";
    TokenType2["RightBrace"] = "}";
    TokenType2["LeftBracket"] = "[";
    TokenType2["RightBracket"] = "]";
    TokenType2["Comma"] = ",";
    TokenType2["Colon"] = ":";
    TokenType2["Semicolon"] = ";";
    TokenType2["Annotation"] = "Annotation";
    TokenType2["StringStart"] = "StringStart";
    TokenType2["StringMiddle"] = "StringMiddle";
    TokenType2["StringEnd"] = "StringEnd";
    TokenType2["EOF"] = "EOF";
    TokenType2["Error"] = "Error";
    TokenType2["Newline"] = "Newline";
    TokenType2["Comment"] = "Comment";
    return TokenType2;
  })(TokenType || {});
  var KEYWORDS = {
    fn: "fn" /* Fn */,
    let: "let" /* Let */,
    type: "type" /* Type */,
    actor: "actor" /* Actor */,
    contract: "contract" /* Contract */,
    server: "server" /* Server */,
    component: "component" /* Component */,
    state: "state" /* State */,
    on: "on" /* On */,
    match: "match" /* Match */,
    if: "if" /* If */,
    else: "else" /* Else */,
    for: "for" /* For */,
    in: "in" /* In */,
    return: "return" /* Return */,
    reply: "reply" /* Reply */,
    spawn: "spawn" /* Spawn */,
    deploy: "deploy" /* Deploy */,
    emit: "emit" /* Emit */,
    pub: "pub" /* Pub */,
    use: "use" /* Use */,
    mod: "mod" /* Mod */,
    own: "own" /* Own */,
    shared: "shared" /* Shared */,
    scope: "scope" /* Scope */,
    parallel: "parallel" /* Parallel */,
    supervise: "supervise" /* Supervise */,
    init: "init" /* Init */,
    with: "with" /* With */,
    pure: "pure" /* Pure */,
    async: "async" /* Async */,
    await: "await" /* Await */,
    true: "true" /* True */,
    false: "false" /* False */,
    mut: "mut" /* Mut */,
    while: "while" /* While */,
    enum: "enum" /* Enum */
  };
  function lookupKeyword(identifier) {
    return KEYWORDS[identifier] ?? "Identifier" /* Identifier */;
  }

  // src/lexer/lexer.ts
  var Lexer = class {
    constructor(source, file = "<stdin>") {
      __publicField(this, "source");
      __publicField(this, "file");
      __publicField(this, "pos", 0);
      __publicField(this, "line", 1);
      __publicField(this, "column", 1);
      __publicField(this, "tokens", []);
      /** Stack tracking brace depth for each nested string interpolation */
      __publicField(this, "interpolationStack", []);
      this.source = source;
      this.file = file;
    }
    tokenize() {
      while (!this.isAtEnd()) {
        this.skipWhitespace();
        if (this.isAtEnd()) break;
        this.scanToken();
      }
      this.tokens.push(this.makeToken("EOF" /* EOF */, "", this.currentPosition()));
      return this.tokens;
    }
    scanToken() {
      const start = this.currentPosition();
      const ch = this.advance();
      switch (ch) {
        // Single-character tokens
        case "(":
          this.addToken("(" /* LeftParen */, ch, start);
          break;
        case ")":
          this.addToken(")" /* RightParen */, ch, start);
          break;
        case "{":
          if (this.interpolationStack.length > 0) {
            this.interpolationStack[this.interpolationStack.length - 1]++;
          }
          this.addToken("{" /* LeftBrace */, ch, start);
          break;
        case "}":
          if (this.interpolationStack.length > 0) {
            const depth = this.interpolationStack[this.interpolationStack.length - 1];
            if (depth === 0) {
              this.interpolationStack.pop();
              this.interpolatedStringContinuation(start);
              break;
            }
            this.interpolationStack[this.interpolationStack.length - 1]--;
          }
          this.addToken("}" /* RightBrace */, ch, start);
          break;
        case "[":
          this.addToken("[" /* LeftBracket */, ch, start);
          break;
        case "]":
          this.addToken("]" /* RightBracket */, ch, start);
          break;
        case ",":
          this.addToken("," /* Comma */, ch, start);
          break;
        case ";":
          this.addToken(";" /* Semicolon */, ch, start);
          break;
        case "%":
          this.addToken("%" /* Percent */, ch, start);
          break;
        // Potentially multi-character tokens
        case "+":
          if (this.match("=")) this.addToken("+=" /* PlusAssign */, "+=", start);
          else this.addToken("+" /* Plus */, ch, start);
          break;
        case "-":
          if (this.match(">")) this.addToken("->" /* Arrow */, "->", start);
          else if (this.match("=")) this.addToken("-=" /* MinusAssign */, "-=", start);
          else this.addToken("-" /* Minus */, ch, start);
          break;
        case "*":
          this.addToken("*" /* Star */, ch, start);
          break;
        case "/":
          if (this.match("/")) {
            this.lineComment(start);
          } else if (this.match("*")) {
            this.blockComment(start);
          } else {
            this.addToken("/" /* Slash */, ch, start);
          }
          break;
        case "=":
          if (this.match("=")) this.addToken("==" /* Eq */, "==", start);
          else if (this.match(">")) this.addToken("=>" /* FatArrow */, "=>", start);
          else this.addToken("=" /* Assign */, ch, start);
          break;
        case "!":
          if (this.match("=")) this.addToken("!=" /* NotEq */, "!=", start);
          else this.addToken("!" /* Not */, ch, start);
          break;
        case "<":
          if (this.match("=")) this.addToken("<=" /* LtEq */, "<=", start);
          else this.addToken("<" /* Lt */, ch, start);
          break;
        case ">":
          if (this.match("=")) this.addToken(">=" /* GtEq */, ">=", start);
          else this.addToken(">" /* Gt */, ch, start);
          break;
        case "&":
          if (this.match("&")) this.addToken("&&" /* And */, "&&", start);
          else this.addToken("&" /* Ampersand */, "&", start);
          break;
        case "|":
          if (this.match("|")) this.addToken("||" /* Or */, "||", start);
          else this.addToken("|" /* Pipe */, "|", start);
          break;
        case ":":
          if (this.match(":")) this.addToken("::" /* ColonColon */, "::", start);
          else this.addToken(":" /* Colon */, ":", start);
          break;
        case ".":
          if (this.match(".")) {
            if (this.match("=")) this.addToken("..=" /* DotDotEq */, "..=", start);
            else this.addToken(".." /* DotDot */, "..", start);
          } else {
            this.addToken("." /* Dot */, ".", start);
          }
          break;
        case "#":
          if (this.match("[")) {
            this.annotation(start);
          } else {
            this.addToken("#" /* Hash */, ch, start);
          }
          break;
        case '"':
          this.string(start);
          break;
        default:
          if (isDigit(ch)) {
            this.number(ch, start);
          } else if (isIdentStart(ch)) {
            this.identifier(ch, start);
          } else {
            this.addToken("Error" /* Error */, ch, start);
          }
      }
    }
    lineComment(start) {
      let value = "//";
      while (!this.isAtEnd() && this.peek() !== "\n") {
        value += this.advance();
      }
      this.addToken("Comment" /* Comment */, value, start);
    }
    blockComment(start) {
      let value = "/*";
      let depth = 1;
      while (!this.isAtEnd() && depth > 0) {
        if (this.peek() === "/" && this.peekNext() === "*") {
          value += this.advance();
          value += this.advance();
          depth++;
        } else if (this.peek() === "*" && this.peekNext() === "/") {
          value += this.advance();
          value += this.advance();
          depth--;
        } else {
          value += this.advance();
        }
      }
      if (depth > 0) {
        this.addToken("Error" /* Error */, "unterminated block comment", start);
      } else {
        this.addToken("Comment" /* Comment */, value, start);
      }
    }
    annotation(start) {
      let value = "#[";
      let depth = 1;
      while (!this.isAtEnd() && depth > 0) {
        const ch = this.advance();
        value += ch;
        if (ch === "[") depth++;
        else if (ch === "]") depth--;
      }
      this.addToken("Annotation" /* Annotation */, value, start);
    }
    string(start) {
      let value = "";
      while (!this.isAtEnd() && this.peek() !== '"') {
        if (this.peek() === "\\") {
          this.advance();
          const escaped = this.advance();
          switch (escaped) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "	";
              break;
            case "r":
              value += "\r";
              break;
            case "0":
              value += "\0";
              break;
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            case "{":
              value += "{";
              break;
            case "}":
              value += "}";
              break;
            default:
              value += "\\" + escaped;
          }
        } else if (this.peek() === "{") {
          this.advance();
          this.addToken("StringStart" /* StringStart */, value, start);
          this.interpolationStack.push(0);
          return;
        } else {
          value += this.advance();
        }
      }
      if (this.isAtEnd()) {
        this.addToken("Error" /* Error */, value, start);
        return;
      }
      this.advance();
      this.addToken("StringLiteral" /* StringLiteral */, value, start);
    }
    /** Resume lexing a string after an interpolation expression ends (at '}') */
    interpolatedStringContinuation(start) {
      let value = "";
      while (!this.isAtEnd() && this.peek() !== '"') {
        if (this.peek() === "\\") {
          this.advance();
          const escaped = this.advance();
          switch (escaped) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "	";
              break;
            case "r":
              value += "\r";
              break;
            case "0":
              value += "\0";
              break;
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            case "{":
              value += "{";
              break;
            case "}":
              value += "}";
              break;
            default:
              value += "\\" + escaped;
          }
        } else if (this.peek() === "{") {
          this.advance();
          this.addToken("StringMiddle" /* StringMiddle */, value, start);
          this.interpolationStack.push(0);
          return;
        } else {
          value += this.advance();
        }
      }
      if (this.isAtEnd()) {
        this.addToken("Error" /* Error */, value, start);
        return;
      }
      this.advance();
      this.addToken("StringEnd" /* StringEnd */, value, start);
    }
    number(first, start) {
      let value = first;
      let isFloat = false;
      if (first === "0" && !this.isAtEnd()) {
        const next = this.peek();
        if (next === "x" || next === "X") {
          value += this.advance();
          while (!this.isAtEnd() && (isHexDigit(this.peek()) || this.peek() === "_")) {
            value += this.advance();
          }
          this.addToken("IntLiteral" /* IntLiteral */, value, start);
          return;
        }
        if (next === "b" || next === "B") {
          value += this.advance();
          while (!this.isAtEnd() && (this.peek() === "0" || this.peek() === "1" || this.peek() === "_")) {
            value += this.advance();
          }
          this.addToken("IntLiteral" /* IntLiteral */, value, start);
          return;
        }
      }
      while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === "_")) {
        value += this.advance();
      }
      if (!this.isAtEnd() && this.peek() === "." && this.peekNext() !== ".") {
        isFloat = true;
        value += this.advance();
        while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === "_")) {
          value += this.advance();
        }
      }
      if (!this.isAtEnd() && (this.peek() === "e" || this.peek() === "E")) {
        isFloat = true;
        value += this.advance();
        if (!this.isAtEnd() && (this.peek() === "+" || this.peek() === "-")) {
          value += this.advance();
        }
        while (!this.isAtEnd() && isDigit(this.peek())) {
          value += this.advance();
        }
      }
      this.addToken(isFloat ? "FloatLiteral" /* FloatLiteral */ : "IntLiteral" /* IntLiteral */, value, start);
    }
    identifier(first, start) {
      let value = first;
      while (!this.isAtEnd() && isIdentPart(this.peek())) {
        value += this.advance();
      }
      const keywordType = lookupKeyword(value);
      if (keywordType === "true" /* True */ || keywordType === "false" /* False */) {
        this.addToken("BoolLiteral" /* BoolLiteral */, value, start);
      } else if (keywordType !== "Identifier" /* Identifier */) {
        this.addToken(keywordType, value, start);
      } else {
        const isPascalCase = value[0] >= "A" && value[0] <= "Z" && /[a-z]/.test(value);
        this.addToken(
          isPascalCase ? "TypeIdentifier" /* TypeIdentifier */ : "Identifier" /* Identifier */,
          value,
          start
        );
      }
    }
    // --- Helpers ---
    advance() {
      const ch = this.source[this.pos];
      this.pos++;
      if (ch === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      return ch;
    }
    peek() {
      return this.source[this.pos] ?? "\0";
    }
    peekNext() {
      return this.source[this.pos + 1] ?? "\0";
    }
    match(expected) {
      if (this.isAtEnd() || this.source[this.pos] !== expected) return false;
      this.advance();
      return true;
    }
    isAtEnd() {
      return this.pos >= this.source.length;
    }
    skipWhitespace() {
      while (!this.isAtEnd()) {
        const ch = this.peek();
        if (ch === " " || ch === "	" || ch === "\r" || ch === "\n") {
          this.advance();
        } else {
          break;
        }
      }
    }
    currentPosition() {
      return { line: this.line, column: this.column, offset: this.pos };
    }
    makeToken(type, value, start) {
      return {
        type,
        value,
        span: {
          start,
          end: this.currentPosition(),
          file: this.file
        }
      };
    }
    addToken(type, value, start) {
      this.tokens.push(this.makeToken(type, value, start));
    }
  };
  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }
  function isHexDigit(ch) {
    return isDigit(ch) || ch >= "a" && ch <= "f" || ch >= "A" && ch <= "F";
  }
  function isIdentStart(ch) {
    return ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch === "_";
  }
  function isIdentPart(ch) {
    return isIdentStart(ch) || isDigit(ch);
  }

  // src/errors/index.ts
  var ANSI_RED = "\x1B[31m";
  var ANSI_YELLOW = "\x1B[33m";
  var ANSI_CYAN = "\x1B[36m";
  var ANSI_BOLD = "\x1B[1m";
  var ANSI_RESET = "\x1B[0m";
  function severityColor(severity) {
    switch (severity) {
      case "error":
        return ANSI_RED;
      case "warning":
        return ANSI_YELLOW;
      case "info":
        return ANSI_CYAN;
    }
  }
  function severityLabel(severity) {
    switch (severity) {
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "info":
        return "info";
    }
  }
  function formatDiagnostic(diagnostic, source, options) {
    const { severity, code, message, span, notes, suggestion } = diagnostic;
    const noColor = options?.noColor ?? false;
    const color = noColor ? "" : severityColor(severity);
    const bold = noColor ? "" : ANSI_BOLD;
    const cyan = noColor ? "" : ANSI_CYAN;
    const reset = noColor ? "" : ANSI_RESET;
    const label = severityLabel(severity);
    const lines = source.split("\n");
    const line = lines[span.start.line - 1] ?? "";
    const lineNumStr = String(span.start.line);
    const gutter = " ".repeat(lineNumStr.length + 1);
    let output = `${color}${bold}${label}[${code}]${reset}${bold}: ${message}${reset}
`;
    output += `${gutter}${cyan}-->${reset} ${span.file}:${span.start.line}:${span.start.column}
`;
    output += `${gutter}${cyan} |${reset}
`;
    output += `${cyan}${lineNumStr.padStart(lineNumStr.length + 1)} |${reset} ${line}
`;
    const underlineStart = span.start.column - 1;
    const underlineLen = Math.max(
      1,
      span.start.line === span.end.line ? span.end.column - span.start.column : line.length - underlineStart
    );
    output += `${gutter}${cyan} |${reset} ${" ".repeat(underlineStart)}${color}${"^".repeat(underlineLen)}${reset}
`;
    for (const note of notes) {
      output += `${gutter}${cyan} =${reset} ${bold}note${reset}: ${note}
`;
    }
    if (suggestion) {
      output += `${gutter}${cyan} =${reset} ${bold}suggestion${reset}: ${suggestion}
`;
    }
    return output;
  }
  function createError(code, message, span, options = {}) {
    return {
      severity: "error",
      code,
      message,
      span,
      notes: options.notes ?? [],
      suggestion: options.suggestion
    };
  }
  function createWarning(code, message, span, options = {}) {
    return {
      severity: "warning",
      code,
      message,
      span,
      notes: options.notes ?? [],
      suggestion: options.suggestion
    };
  }

  // src/parser/parser.ts
  var Parser = class {
    constructor(tokens) {
      __publicField(this, "tokens");
      __publicField(this, "pos", 0);
      __publicField(this, "diagnostics", []);
      __publicField(this, "allowRefinement", true);
      __publicField(this, "allowUnionType", true);
      this.tokens = tokens.filter(
        (t) => t.type !== "Comment" /* Comment */ && t.type !== "Newline" /* Newline */
      );
    }
    parse() {
      const items = [];
      const start = this.current().span;
      while (!this.isAtEnd()) {
        try {
          const item = this.parseTopLevelItem();
          if (item) items.push(item);
        } catch (e) {
          this.synchronize();
        }
      }
      const program = {
        kind: "Program",
        items,
        span: this.spanFrom(start)
      };
      return { program, diagnostics: this.diagnostics };
    }
    getDiagnostics() {
      return this.diagnostics;
    }
    // ─── Top-Level ─────────────────────────────────────────────────
    parseTopLevelItem() {
      const annotations = this.parseAnnotations();
      const visibility = this.parseVisibility();
      const token = this.current();
      switch (token.type) {
        case "fn" /* Fn */:
        case "pure" /* Pure */:
        case "async" /* Async */:
          return this.parseFunctionDecl(annotations, visibility);
        case "type" /* Type */:
          return this.parseTypeDecl(annotations, visibility);
        case "actor" /* Actor */:
          return this.parseActorDecl(annotations, visibility);
        case "contract" /* Contract */:
          return this.parseContractDecl(annotations, visibility);
        case "server" /* Server */:
          return this.parseServerDecl(annotations, visibility);
        case "component" /* Component */:
          return this.parseComponentDecl(annotations, visibility);
        case "enum" /* Enum */:
          return this.parseEnumDecl(annotations, visibility);
        case "use" /* Use */:
          return this.parseUseDecl();
        case "mod" /* Mod */:
          return this.parseModDecl();
        case "state" /* State */:
          return this.parseStateDecl();
        case "EOF" /* EOF */:
          return null;
        default:
          this.error(`Unexpected token '${token.value}' at top level`);
          this.advance();
          return null;
      }
    }
    // ─── Annotations ───────────────────────────────────────────────
    parseAnnotations() {
      const annotations = [];
      while (this.check("Annotation" /* Annotation */)) {
        const token = this.advance();
        const raw = token.value;
        const inner = raw.slice(2, -1);
        const parenIdx = inner.indexOf("(");
        let name;
        let args;
        if (parenIdx === -1) {
          name = inner.trim();
          args = "";
        } else {
          name = inner.slice(0, parenIdx).trim();
          args = inner.slice(parenIdx + 1, -1).trim();
        }
        annotations.push({
          kind: "Annotation",
          name,
          args,
          raw,
          span: token.span
        });
      }
      return annotations;
    }
    // ─── Visibility ────────────────────────────────────────────────
    parseVisibility() {
      if (this.check("pub" /* Pub */)) {
        this.advance();
        if (this.check("(" /* LeftParen */)) {
          this.advance();
          if (this.checkIdent("pkg")) {
            this.advance();
            this.expect(")" /* RightParen */, "Expected ')' after 'pkg'");
            return "package";
          }
          this.expect(")" /* RightParen */, "Expected ')' after visibility modifier");
          return "public";
        }
        return "public";
      }
      return "private";
    }
    // ─── Function Declaration ──────────────────────────────────────
    parseFunctionDecl(annotations, visibility) {
      const start = this.current().span;
      let isPure = false;
      let isAsync = false;
      if (this.check("pure" /* Pure */)) {
        isPure = true;
        this.advance();
      }
      if (this.check("async" /* Async */)) {
        isAsync = true;
        this.advance();
      }
      this.expect("fn" /* Fn */, "Expected 'fn'");
      const name = this.expectIdent("Expected function name");
      this.expect("(" /* LeftParen */, "Expected '(' after function name");
      const params = this.parseParams();
      this.expect(")" /* RightParen */, "Expected ')'");
      let returnType = null;
      if (this.check("->" /* Arrow */)) {
        this.advance();
        this.allowRefinement = false;
        returnType = this.parseTypeExpr();
        this.allowRefinement = true;
      }
      let effects = [];
      if (this.check("with" /* With */)) {
        this.advance();
        effects = this.parseEffectList();
      }
      const body = this.parseBlock();
      return {
        kind: "FunctionDecl",
        name,
        annotations,
        visibility,
        isPure,
        isAsync,
        params,
        returnType,
        effects,
        body,
        span: this.spanFrom(start)
      };
    }
    parseParams() {
      const params = [];
      if (this.check(")" /* RightParen */)) return params;
      params.push(this.parseParam());
      while (this.check("," /* Comma */)) {
        this.advance();
        if (this.check(")" /* RightParen */)) break;
        params.push(this.parseParam());
      }
      return params;
    }
    parseParam() {
      const start = this.current().span;
      const name = this.expectIdent("Expected parameter name");
      this.expect(":" /* Colon */, "Expected ':' after parameter name");
      const ownership = this.parseOwnership();
      const typeAnnotation = this.parseTypeExpr();
      return {
        kind: "Parameter",
        name,
        ownership,
        typeAnnotation,
        span: this.spanFrom(start)
      };
    }
    parseOwnership() {
      if (this.check("own" /* Own */)) {
        this.advance();
        return "own";
      }
      if (this.check("shared" /* Shared */)) {
        this.advance();
        return "shared";
      }
      if (this.check("&" /* Ampersand */)) {
        this.advance();
        if (this.check("mut" /* Mut */)) {
          this.advance();
          return "borrowed_mut";
        }
        return "borrowed";
      }
      return "owned";
    }
    parseEffectList() {
      const effects = [];
      effects.push(this.expectIdentOrType("Expected effect name"));
      while (this.check("," /* Comma */)) {
        this.advance();
        effects.push(this.expectIdentOrType("Expected effect name"));
      }
      return effects;
    }
    // ─── Type Declaration ──────────────────────────────────────────
    parseTypeDecl(annotations, visibility) {
      const start = this.current().span;
      this.expect("type" /* Type */, "Expected 'type'");
      const name = this.expectIdentOrType("Expected type name");
      const typeParams = this.parseTypeParams();
      if (this.check("=" /* Assign */)) {
        this.advance();
        const type = this.parseTypeExpr();
        return {
          kind: "TypeDecl",
          name,
          annotations,
          visibility,
          typeParams,
          body: { kind: "Alias", type },
          span: this.spanFrom(start)
        };
      }
      if (this.check("{" /* LeftBrace */)) {
        this.advance();
        const fields = [];
        while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
          fields.push(this.parseFieldDecl());
          this.match("," /* Comma */);
        }
        this.expect("}" /* RightBrace */, "Expected '}'");
        return {
          kind: "TypeDecl",
          name,
          annotations,
          visibility,
          typeParams,
          body: { kind: "Struct", fields },
          span: this.spanFrom(start)
        };
      }
      this.error("Expected '=', or '{' after type name");
      return {
        kind: "TypeDecl",
        name,
        annotations,
        visibility,
        typeParams,
        body: { kind: "Alias", type: { kind: "NamedType", name: "Unknown", path: [], span: this.current().span } },
        span: this.spanFrom(start)
      };
    }
    parseTypeParams() {
      if (!this.check("<" /* Lt */)) return [];
      this.advance();
      const params = [];
      params.push(this.parseTypeParam());
      while (this.check("," /* Comma */)) {
        this.advance();
        params.push(this.parseTypeParam());
      }
      this.expect(">" /* Gt */, "Expected '>'");
      return params;
    }
    parseTypeParam() {
      const start = this.current().span;
      const name = this.expectIdentOrType("Expected type parameter name");
      return { kind: "TypeParam", name, span: this.spanFrom(start) };
    }
    parseFieldDecl() {
      const start = this.current().span;
      const name = this.expectIdent("Expected field name");
      this.expect(":" /* Colon */, "Expected ':'");
      const typeAnnotation = this.parseTypeExpr();
      let defaultValue = null;
      if (this.check("=" /* Assign */)) {
        this.advance();
        defaultValue = this.parseExpr();
      }
      return {
        kind: "FieldDecl",
        name,
        typeAnnotation,
        defaultValue,
        span: this.spanFrom(start)
      };
    }
    // ─── Actor Declaration ─────────────────────────────────────────
    parseActorDecl(annotations, visibility) {
      const start = this.current().span;
      this.expect("actor" /* Actor */, "Expected 'actor'");
      const name = this.expectIdentOrType("Expected actor name");
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const members = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        const member = this.parseActorMember();
        if (member) members.push(member);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return {
        kind: "ActorDecl",
        name,
        annotations,
        visibility,
        members,
        span: this.spanFrom(start)
      };
    }
    parseActorMember() {
      const annotations = this.parseAnnotations();
      const visibility = this.parseVisibility();
      if (this.check("state" /* State */)) {
        return this.parseStateDecl();
      }
      if (this.check("on" /* On */)) {
        return this.parseOnHandler();
      }
      if (this.check("fn" /* Fn */) || this.check("pure" /* Pure */) || this.check("async" /* Async */)) {
        return this.parseFunctionDecl(annotations, visibility);
      }
      if (this.check("supervise" /* Supervise */)) {
        return this.parseSuperviseDecl();
      }
      if (this.check("init" /* Init */)) {
        return this.parseInitDecl();
      }
      this.error(`Unexpected token '${this.current().value}' in actor body`);
      this.advance();
      return null;
    }
    parseStateDecl() {
      const start = this.current().span;
      this.expect("state" /* State */, "Expected 'state'");
      const name = this.expectIdent("Expected state variable name");
      this.expect(":" /* Colon */, "Expected ':'");
      const typeAnnotation = this.parseTypeExpr();
      let initializer = null;
      if (this.check("=" /* Assign */)) {
        this.advance();
        initializer = this.parseExpr();
      }
      return {
        kind: "StateDecl",
        name,
        typeAnnotation,
        initializer,
        span: this.spanFrom(start)
      };
    }
    parseOnHandler() {
      const start = this.current().span;
      this.expect("on" /* On */, "Expected 'on'");
      const messageName = this.expectIdentOrType("Expected message name");
      this.expect("(" /* LeftParen */, "Expected '('");
      const params = this.parseParams();
      this.expect(")" /* RightParen */, "Expected ')'");
      let returnType = null;
      if (this.check("->" /* Arrow */)) {
        this.advance();
        this.allowRefinement = false;
        returnType = this.parseTypeExpr();
        this.allowRefinement = true;
      }
      const body = this.parseBlock();
      return {
        kind: "OnHandler",
        messageName,
        params,
        returnType,
        body,
        span: this.spanFrom(start)
      };
    }
    parseSuperviseDecl() {
      const start = this.current().span;
      this.expect("supervise" /* Supervise */, "Expected 'supervise'");
      const childName = this.expectIdentOrType("Expected supervised actor name");
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const options = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        const optStart = this.current().span;
        const key = this.expectIdent("Expected option name");
        this.expect(":" /* Colon */, "Expected ':'");
        const value = this.parseExpr();
        options.push({
          kind: "SuperviseOption",
          key,
          value,
          span: this.spanFrom(optStart)
        });
        this.match("," /* Comma */);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return {
        kind: "SuperviseDecl",
        childName,
        options,
        span: this.spanFrom(start)
      };
    }
    parseInitDecl() {
      const start = this.current().span;
      this.expect("init" /* Init */, "Expected 'init'");
      this.expect("(" /* LeftParen */, "Expected '('");
      const params = this.parseParams();
      this.expect(")" /* RightParen */, "Expected ')'");
      const body = this.parseBlock();
      return {
        kind: "InitDecl",
        params,
        body,
        span: this.spanFrom(start)
      };
    }
    // ─── Contract Declaration ──────────────────────────────────────
    parseContractDecl(annotations, visibility) {
      const start = this.current().span;
      this.expect("contract" /* Contract */, "Expected 'contract'");
      const name = this.expectIdentOrType("Expected contract name");
      const interfaces = [];
      if (this.check(":" /* Colon */)) {
        this.advance();
        interfaces.push(this.expectIdentOrType("Expected interface name"));
        while (this.check("," /* Comma */)) {
          this.advance();
          interfaces.push(this.expectIdentOrType("Expected interface name"));
        }
      }
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const members = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        const member = this.parseContractMember();
        if (member) members.push(member);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return {
        kind: "ContractDecl",
        name,
        annotations,
        visibility,
        interfaces,
        members,
        span: this.spanFrom(start)
      };
    }
    parseContractMember() {
      const annotations = this.parseAnnotations();
      const visibility = this.parseVisibility();
      if (this.check("state" /* State */)) {
        return this.parseStateDecl();
      }
      if (this.check("fn" /* Fn */) || this.check("pure" /* Pure */) || this.check("async" /* Async */)) {
        return this.parseFunctionDecl(annotations, visibility);
      }
      if (this.check("init" /* Init */)) {
        return this.parseInitDecl();
      }
      this.error(`Unexpected token '${this.current().value}' in contract body`);
      this.advance();
      return null;
    }
    // ─── Server Declaration ────────────────────────────────────────
    parseServerDecl(annotations, visibility) {
      const start = this.current().span;
      this.expect("server" /* Server */, "Expected 'server'");
      const name = this.expectIdentOrType("Expected server name");
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const members = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        const member = this.parseServerMember();
        if (member) members.push(member);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return {
        kind: "ServerDecl",
        name,
        annotations,
        visibility,
        members,
        span: this.spanFrom(start)
      };
    }
    parseServerMember() {
      const annotations = this.parseAnnotations();
      const visibility = this.parseVisibility();
      if (this.check("fn" /* Fn */) || this.check("pure" /* Pure */) || this.check("async" /* Async */)) {
        return this.parseFunctionDecl(annotations, visibility);
      }
      if (this.check("state" /* State */)) {
        return this.parseStateDecl();
      }
      if (this.check("Identifier" /* Identifier */)) {
        const start = this.current().span;
        const name = this.advance().value;
        if (this.check(":" /* Colon */)) {
          this.advance();
          const value = this.parseExpr();
          return {
            kind: "FieldAssignment",
            name,
            value,
            span: this.spanFrom(start)
          };
        }
      }
      this.error(`Unexpected token '${this.current().value}' in server body`);
      this.advance();
      return null;
    }
    // ─── Component Declaration ─────────────────────────────────────
    parseComponentDecl(annotations, visibility) {
      const start = this.current().span;
      this.expect("component" /* Component */, "Expected 'component'");
      const name = this.expectIdentOrType("Expected component name");
      this.expect("(" /* LeftParen */, "Expected '('");
      const params = this.parseParams();
      this.expect(")" /* RightParen */, "Expected ')'");
      const body = this.parseBlock();
      return {
        kind: "ComponentDecl",
        name,
        annotations,
        visibility,
        params,
        body,
        span: this.spanFrom(start)
      };
    }
    // ─── Use Declaration ───────────────────────────────────────────
    parseUseDecl() {
      const start = this.current().span;
      this.expect("use" /* Use */, "Expected 'use'");
      const path = [];
      path.push(this.expectPathSegment("Expected module path"));
      while (this.check("::" /* ColonColon */)) {
        this.advance();
        if (this.check("*" /* Star */)) {
          this.advance();
          this.match(";" /* Semicolon */);
          return {
            kind: "UseDecl",
            path,
            items: [{ kind: "Wildcard" }],
            isWildcard: true,
            span: this.spanFrom(start)
          };
        }
        if (this.check("{" /* LeftBrace */)) {
          this.advance();
          const items = [];
          while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
            const itemName = this.expectPathSegment("Expected import name");
            let alias = null;
            if (this.checkIdent("as")) {
              this.advance();
              alias = this.expectPathSegment("Expected alias name");
            }
            items.push({ kind: "Named", name: itemName, alias });
            if (!this.match("," /* Comma */)) break;
          }
          this.expect("}" /* RightBrace */, "Expected '}'");
          this.match(";" /* Semicolon */);
          return {
            kind: "UseDecl",
            path,
            items,
            isWildcard: false,
            span: this.spanFrom(start)
          };
        }
        path.push(this.expectPathSegment("Expected module path segment"));
      }
      this.match(";" /* Semicolon */);
      const lastName = path[path.length - 1];
      const modulePath = path.slice(0, -1);
      return {
        kind: "UseDecl",
        path: modulePath,
        items: [{ kind: "Named", name: lastName, alias: null }],
        isWildcard: false,
        span: this.spanFrom(start)
      };
    }
    // ─── Mod Declaration ───────────────────────────────────────────
    parseModDecl() {
      const start = this.current().span;
      this.expect("mod" /* Mod */, "Expected 'mod'");
      const name = this.expectIdent("Expected module name");
      if (this.check("{" /* LeftBrace */)) {
        this.advance();
        const body = [];
        while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
          const item = this.parseTopLevelItem();
          if (item) body.push(item);
        }
        this.expect("}" /* RightBrace */, "Expected '}'");
        return { kind: "ModDecl", name, body, span: this.spanFrom(start) };
      }
      this.match(";" /* Semicolon */);
      return { kind: "ModDecl", name, body: null, span: this.spanFrom(start) };
    }
    // ─── Enum Declaration ──────────────────────────────────────────
    parseEnumDecl(annotations, visibility) {
      const start = this.current().span;
      this.expect("enum" /* Enum */, "Expected 'enum'");
      const name = this.expectIdentOrType("Expected enum name");
      const typeParams = this.parseTypeParams();
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const variants = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        variants.push(this.parseEnumVariant());
        this.match("," /* Comma */);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return {
        kind: "EnumDecl",
        name,
        annotations,
        visibility,
        typeParams,
        variants,
        span: this.spanFrom(start)
      };
    }
    parseEnumVariant() {
      const start = this.current().span;
      const name = this.expectIdentOrType("Expected variant name");
      if (this.check("(" /* LeftParen */)) {
        this.advance();
        const fields = [];
        if (!this.check(")" /* RightParen */)) {
          fields.push(this.parseTypeExpr());
          while (this.check("," /* Comma */)) {
            this.advance();
            if (this.check(")" /* RightParen */)) break;
            fields.push(this.parseTypeExpr());
          }
        }
        this.expect(")" /* RightParen */, "Expected ')'");
        return { kind: "TupleVariant", name, fields, span: this.spanFrom(start) };
      }
      if (this.check("{" /* LeftBrace */)) {
        this.advance();
        const fields = [];
        while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
          fields.push(this.parseFieldDecl());
          this.match("," /* Comma */);
        }
        this.expect("}" /* RightBrace */, "Expected '}'");
        return { kind: "StructVariant", name, fields, span: this.spanFrom(start) };
      }
      return { kind: "UnitVariant", name, span: this.spanFrom(start) };
    }
    // ─── Type Expressions ──────────────────────────────────────────
    parseTypeExpr() {
      let left = this.parsePrimaryType();
      if (this.allowUnionType && this.check("|" /* Pipe */)) {
        const types = [left];
        while (this.check("|" /* Pipe */)) {
          this.advance();
          types.push(this.parsePrimaryType());
        }
        return {
          kind: "UnionType",
          types,
          span: this.spanFrom(left.span)
        };
      }
      return left;
    }
    parsePrimaryType() {
      const start = this.current().span;
      if (this.check("&" /* Ampersand */)) {
        this.advance();
        const mutable = this.check("mut" /* Mut */);
        if (mutable) this.advance();
        const inner = this.parsePrimaryType();
        return { kind: "ReferenceType", mutable, inner, span: this.spanFrom(start) };
      }
      if (this.check("own" /* Own */)) {
        this.advance();
        const inner = this.parsePrimaryType();
        return { kind: "OwnType", inner, span: this.spanFrom(start) };
      }
      if (this.check("shared" /* Shared */)) {
        this.advance();
        const inner = this.parsePrimaryType();
        return { kind: "SharedType", inner, span: this.spanFrom(start) };
      }
      if (this.check("[" /* LeftBracket */)) {
        this.advance();
        const elementType = this.parseTypeExpr();
        this.expect("]" /* RightBracket */, "Expected ']'");
        return { kind: "ArrayType", elementType, span: this.spanFrom(start) };
      }
      if (this.check("TypeIdentifier" /* TypeIdentifier */) || this.check("Identifier" /* Identifier */)) {
        const name = this.advance().value;
        if (this.check("<" /* Lt */)) {
          this.advance();
          const typeArgs = [];
          typeArgs.push(this.parseTypeExpr());
          while (this.check("," /* Comma */)) {
            this.advance();
            typeArgs.push(this.parseTypeExpr());
          }
          this.expect(">" /* Gt */, "Expected '>'");
          const result2 = {
            kind: "GenericType",
            name,
            path: [],
            typeArgs,
            span: this.spanFrom(start)
          };
          if (this.allowRefinement && this.check("{" /* LeftBrace */)) {
            return this.parseRefinement(result2);
          }
          return result2;
        }
        const result = {
          kind: "NamedType",
          name,
          path: [],
          span: this.spanFrom(start)
        };
        if (this.allowRefinement && this.check("{" /* LeftBrace */)) {
          return this.parseRefinement(result);
        }
        return result;
      }
      if (this.check("(" /* LeftParen */)) {
        this.advance();
        if (this.check(")" /* RightParen */)) {
          this.advance();
          return { kind: "NamedType", name: "()", path: [], span: this.spanFrom(start) };
        }
        const inner = this.parseTypeExpr();
        this.expect(")" /* RightParen */, "Expected ')'");
        return inner;
      }
      this.error(`Expected type expression, got '${this.current().value}'`);
      this.advance();
      return { kind: "NamedType", name: "Error", path: [], span: this.spanFrom(start) };
    }
    parseRefinement(baseType) {
      const start = baseType.span;
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const constraints = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        const cStart = this.current().span;
        if (this.check("Identifier" /* Identifier */) && this.peekType(1) === ":" /* Colon */) {
          const name = this.advance().value;
          this.advance();
          const value = this.parseExpr();
          constraints.push({
            kind: "RefinementConstraint",
            name,
            value,
            span: this.spanFrom(cStart)
          });
        } else {
          const value = this.parseExpr();
          constraints.push({
            kind: "RefinementConstraint",
            name: null,
            value,
            span: this.spanFrom(cStart)
          });
        }
        if (!this.match("," /* Comma */)) break;
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return {
        kind: "RefinedType",
        baseType,
        constraints,
        span: this.spanFrom(start)
      };
    }
    // ─── Blocks & Statements ───────────────────────────────────────
    parseBlock() {
      const start = this.current().span;
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const statements = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        const stmt = this.parseStatement();
        if (stmt) statements.push(stmt);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return { kind: "Block", statements, span: this.spanFrom(start) };
    }
    parseStatement() {
      const token = this.current();
      switch (token.type) {
        case "let" /* Let */:
          return this.parseLetStmt();
        case "return" /* Return */:
          return this.parseReturnStmt();
        case "reply" /* Reply */:
          return this.parseReplyStmt();
        case "emit" /* Emit */:
          return this.parseEmitStmt();
        case "for" /* For */:
          return this.parseForStmt();
        case "while" /* While */:
          return this.parseWhileStmt();
        case "if" /* If */:
          return this.parseIfStmt();
        case "match" /* Match */:
          return this.parseMatchStmt();
        case "spawn" /* Spawn */:
          return this.parseSpawnStmt();
        default: {
          const start = this.current().span;
          const expr = this.parseExpr();
          if (this.check("=" /* Assign */) || this.check("+=" /* PlusAssign */) || this.check("-=" /* MinusAssign */)) {
            const op = this.advance().value;
            const value = this.parseExpr();
            this.match(";" /* Semicolon */);
            return {
              kind: "AssignStmt",
              target: expr,
              operator: op,
              value,
              span: this.spanFrom(start)
            };
          }
          this.match(";" /* Semicolon */);
          return {
            kind: "ExprStmt",
            expr,
            span: this.spanFrom(start)
          };
        }
      }
    }
    parseLetStmt() {
      const start = this.current().span;
      this.expect("let" /* Let */, "Expected 'let'");
      let mutable = false;
      if (this.check("mut" /* Mut */)) {
        mutable = true;
        this.advance();
      }
      const name = this.expectIdent("Expected variable name");
      let typeAnnotation = null;
      if (this.check(":" /* Colon */)) {
        this.advance();
        typeAnnotation = this.parseTypeExpr();
      }
      this.expect("=" /* Assign */, "Expected '=' in let binding");
      const initializer = this.parseExpr();
      this.match(";" /* Semicolon */);
      return {
        kind: "LetStmt",
        name,
        mutable,
        typeAnnotation,
        initializer,
        span: this.spanFrom(start)
      };
    }
    parseReturnStmt() {
      const start = this.current().span;
      this.expect("return" /* Return */, "Expected 'return'");
      let value = null;
      if (!this.check(";" /* Semicolon */) && !this.check("}" /* RightBrace */)) {
        value = this.parseExpr();
      }
      this.match(";" /* Semicolon */);
      return { kind: "ReturnStmt", value, span: this.spanFrom(start) };
    }
    parseReplyStmt() {
      const start = this.current().span;
      this.expect("reply" /* Reply */, "Expected 'reply'");
      const value = this.parseExpr();
      this.match(";" /* Semicolon */);
      return { kind: "ReplyStmt", value, span: this.spanFrom(start) };
    }
    parseEmitStmt() {
      const start = this.current().span;
      this.expect("emit" /* Emit */, "Expected 'emit'");
      const eventName = this.expectIdentOrType("Expected event name");
      this.expect("(" /* LeftParen */, "Expected '('");
      const args = [];
      if (!this.check(")" /* RightParen */)) {
        args.push(this.parseExpr());
        while (this.check("," /* Comma */)) {
          this.advance();
          args.push(this.parseExpr());
        }
      }
      this.expect(")" /* RightParen */, "Expected ')'");
      this.match(";" /* Semicolon */);
      return { kind: "EmitStmt", eventName, args, span: this.spanFrom(start) };
    }
    parseForStmt() {
      const start = this.current().span;
      this.expect("for" /* For */, "Expected 'for'");
      const variable = this.expectIdent("Expected variable name");
      this.expect("in" /* In */, "Expected 'in'");
      const iterable = this.parseExpr();
      const body = this.parseBlock();
      return { kind: "ForStmt", variable, iterable, body, span: this.spanFrom(start) };
    }
    parseWhileStmt() {
      const start = this.current().span;
      this.expect("while" /* While */, "Expected 'while'");
      const condition = this.parseExpr();
      const body = this.parseBlock();
      return { kind: "WhileStmt", condition, body, span: this.spanFrom(start) };
    }
    parseIfStmt() {
      const start = this.current().span;
      this.expect("if" /* If */, "Expected 'if'");
      const condition = this.parseExpr();
      const then = this.parseBlock();
      let else_ = null;
      if (this.check("else" /* Else */)) {
        this.advance();
        if (this.check("if" /* If */)) {
          else_ = this.parseIfStmt();
        } else {
          else_ = this.parseBlock();
        }
      }
      return { kind: "IfStmt", condition, then, else_, span: this.spanFrom(start) };
    }
    parseMatchStmt() {
      const start = this.current().span;
      this.expect("match" /* Match */, "Expected 'match'");
      const subject = this.parseExpr();
      this.expect("{" /* LeftBrace */, "Expected '{'");
      const arms = [];
      while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
        arms.push(this.parseMatchArm());
        this.match("," /* Comma */);
      }
      this.expect("}" /* RightBrace */, "Expected '}'");
      return { kind: "MatchStmt", subject, arms, span: this.spanFrom(start) };
    }
    parseMatchArm() {
      const start = this.current().span;
      const pattern = this.parsePattern();
      this.expect("=>" /* FatArrow */, "Expected '=>'");
      let body;
      if (this.check("{" /* LeftBrace */)) {
        body = this.parseBlock();
      } else {
        body = this.parseExpr();
      }
      return { kind: "MatchArm", pattern, body, span: this.spanFrom(start) };
    }
    parsePattern() {
      const start = this.current().span;
      if (this.check("Identifier" /* Identifier */) && this.current().value === "_") {
        this.advance();
        return { kind: "WildcardPattern", span: this.spanFrom(start) };
      }
      if (this.check("IntLiteral" /* IntLiteral */)) {
        const value = this.advance().value;
        return { kind: "LiteralPattern", value: Number(value), span: this.spanFrom(start) };
      }
      if (this.check("StringLiteral" /* StringLiteral */)) {
        const value = this.advance().value;
        return { kind: "LiteralPattern", value, span: this.spanFrom(start) };
      }
      if (this.check("BoolLiteral" /* BoolLiteral */)) {
        const value = this.advance().value === "true";
        return { kind: "LiteralPattern", value, span: this.spanFrom(start) };
      }
      if (this.check("TypeIdentifier" /* TypeIdentifier */) || this.check("Identifier" /* Identifier */)) {
        const name = this.advance().value;
        if (this.check("(" /* LeftParen */)) {
          this.advance();
          const fields = [];
          if (!this.check(")" /* RightParen */)) {
            fields.push(this.parsePattern());
            while (this.check("," /* Comma */)) {
              this.advance();
              fields.push(this.parsePattern());
            }
          }
          this.expect(")" /* RightParen */, "Expected ')'");
          return { kind: "ConstructorPattern", name, fields, span: this.spanFrom(start) };
        }
        if (name[0] >= "A" && name[0] <= "Z") {
          return { kind: "ConstructorPattern", name, fields: [], span: this.spanFrom(start) };
        }
        return { kind: "IdentPattern", name, span: this.spanFrom(start) };
      }
      this.error(`Expected pattern, got '${this.current().value}'`);
      this.advance();
      return { kind: "WildcardPattern", span: this.spanFrom(start) };
    }
    parseSpawnStmt() {
      const start = this.current().span;
      this.expect("spawn" /* Spawn */, "Expected 'spawn'");
      const actor = this.expectIdentOrType("Expected actor name");
      const args = [];
      if (this.check("(" /* LeftParen */)) {
        this.advance();
        if (!this.check(")" /* RightParen */)) {
          args.push(this.parseExpr());
          while (this.check("," /* Comma */)) {
            this.advance();
            args.push(this.parseExpr());
          }
        }
        this.expect(")" /* RightParen */, "Expected ')'");
      }
      this.match(";" /* Semicolon */);
      return { kind: "SpawnStmt", actor, args, span: this.spanFrom(start) };
    }
    // ─── Expressions (Pratt Parsing) ──────────────────────────────
    parseExpr() {
      return this.parseBinaryExpr(0);
    }
    parseBinaryExpr(minPrec) {
      let left = this.parseUnaryExpr();
      while (true) {
        const prec = this.getInfixPrecedence();
        if (prec < minPrec) break;
        if (this.check(".." /* DotDot */) || this.check("..=" /* DotDotEq */)) {
          const inclusive = this.current().type === "..=" /* DotDotEq */;
          this.advance();
          let end = null;
          if (!this.check("}" /* RightBrace */) && !this.check(")" /* RightParen */) && !this.check("," /* Comma */) && !this.check(";" /* Semicolon */)) {
            end = this.parseBinaryExpr(prec + 1);
          }
          left = {
            kind: "Range",
            start: left,
            end,
            inclusive,
            span: this.spanFrom(left.span)
          };
          continue;
        }
        const op = this.advance().value;
        const right = this.parseBinaryExpr(prec + 1);
        left = {
          kind: "Binary",
          operator: op,
          left,
          right,
          span: this.spanFrom(left.span)
        };
      }
      return left;
    }
    parseUnaryExpr() {
      if (this.check("!" /* Not */) || this.check("-" /* Minus */)) {
        const start = this.current().span;
        const op = this.advance().value;
        const operand = this.parseUnaryExpr();
        return { kind: "Unary", operator: op, operand, span: this.spanFrom(start) };
      }
      return this.parsePostfixExpr();
    }
    parsePostfixExpr() {
      let expr = this.parsePrimaryExpr();
      while (true) {
        if (this.check("." /* Dot */)) {
          this.advance();
          const field = this.expectIdentOrType("Expected field name");
          if (this.check("(" /* LeftParen */)) {
            this.advance();
            const args = this.parseCallArgs();
            this.expect(")" /* RightParen */, "Expected ')'");
            expr = {
              kind: "MethodCall",
              object: expr,
              method: field,
              args,
              span: this.spanFrom(expr.span)
            };
          } else {
            expr = {
              kind: "FieldAccess",
              object: expr,
              field,
              span: this.spanFrom(expr.span)
            };
          }
        } else if (this.check("[" /* LeftBracket */)) {
          this.advance();
          const index = this.parseExpr();
          this.expect("]" /* RightBracket */, "Expected ']'");
          expr = {
            kind: "Index",
            object: expr,
            index,
            span: this.spanFrom(expr.span)
          };
        } else if (this.check("(" /* LeftParen */) && expr.kind === "Ident") {
          this.advance();
          const args = this.parseCallArgs();
          this.expect(")" /* RightParen */, "Expected ')'");
          expr = {
            kind: "Call",
            callee: expr,
            args,
            span: this.spanFrom(expr.span)
          };
        } else if (this.check("(" /* LeftParen */) && expr.kind === "Path") {
          this.advance();
          const args = this.parseCallArgs();
          this.expect(")" /* RightParen */, "Expected ')'");
          expr = {
            kind: "Call",
            callee: expr,
            args,
            span: this.spanFrom(expr.span)
          };
        } else {
          break;
        }
      }
      return expr;
    }
    parsePrimaryExpr() {
      const start = this.current().span;
      if (this.check("IntLiteral" /* IntLiteral */)) {
        return { kind: "IntLiteral", value: this.advance().value, span: this.spanFrom(start) };
      }
      if (this.check("FloatLiteral" /* FloatLiteral */)) {
        return { kind: "FloatLiteral", value: this.advance().value, span: this.spanFrom(start) };
      }
      if (this.check("StringLiteral" /* StringLiteral */)) {
        return { kind: "StringLiteral", value: this.advance().value, span: this.spanFrom(start) };
      }
      if (this.check("StringStart" /* StringStart */)) {
        return this.parseStringInterpolation();
      }
      if (this.check("BoolLiteral" /* BoolLiteral */)) {
        return { kind: "BoolLiteral", value: this.advance().value === "true", span: this.spanFrom(start) };
      }
      if (this.check("deploy" /* Deploy */)) {
        this.advance();
        const contract = this.expectIdentOrType("Expected contract name");
        this.expect("(" /* LeftParen */, "Expected '('");
        const args = this.parseCallArgs();
        this.expect(")" /* RightParen */, "Expected ')'");
        return {
          kind: "Call",
          callee: { kind: "Ident", name: `deploy ${contract}`, span: this.spanFrom(start) },
          args,
          span: this.spanFrom(start)
        };
      }
      if (this.check("Identifier" /* Identifier */) && this.peekType(1) === "!" /* Not */) {
        const name = this.advance().value;
        this.advance();
        this.expect("(" /* LeftParen */, "Expected '(' after macro name");
        const args = [];
        if (!this.check(")" /* RightParen */)) {
          args.push(this.parseExpr());
          while (this.check("," /* Comma */)) {
            this.advance();
            args.push(this.parseExpr());
          }
        }
        this.expect(")" /* RightParen */, "Expected ')'");
        return { kind: "MacroCall", name, args, span: this.spanFrom(start) };
      }
      if (this.check("TypeIdentifier" /* TypeIdentifier */)) {
        const name = this.advance().value;
        if (this.check("::" /* ColonColon */)) {
          const segments = [name];
          while (this.check("::" /* ColonColon */)) {
            this.advance();
            segments.push(this.expectIdentOrType("Expected path segment"));
          }
          if (this.check("(" /* LeftParen */)) {
            this.advance();
            const args = this.parseCallArgs();
            this.expect(")" /* RightParen */, "Expected ')'");
            return {
              kind: "Call",
              callee: { kind: "Path", segments, span: this.spanFrom(start) },
              args,
              span: this.spanFrom(start)
            };
          }
          return { kind: "Path", segments, span: this.spanFrom(start) };
        }
        if (this.check("(" /* LeftParen */)) {
          this.advance();
          const args = this.parseCallArgs();
          this.expect(")" /* RightParen */, "Expected ')'");
          return {
            kind: "Call",
            callee: { kind: "Ident", name, span: this.spanFrom(start) },
            args,
            span: this.spanFrom(start)
          };
        }
        if (this.check("{" /* LeftBrace */)) {
          this.advance();
          const fields = [];
          while (!this.check("}" /* RightBrace */) && !this.isAtEnd()) {
            const fStart = this.current().span;
            const fieldName = this.expectIdent("Expected field name");
            this.expect(":" /* Colon */, "Expected ':'");
            const value = this.parseExpr();
            fields.push({ kind: "StructField", name: fieldName, value, span: this.spanFrom(fStart) });
            if (!this.match("," /* Comma */)) break;
          }
          this.expect("}" /* RightBrace */, "Expected '}'");
          return { kind: "Struct", name, fields, span: this.spanFrom(start) };
        }
        return { kind: "Ident", name, span: this.spanFrom(start) };
      }
      if (this.check("Identifier" /* Identifier */)) {
        const name = this.advance().value;
        if (this.check("::" /* ColonColon */)) {
          const segments = [name];
          while (this.check("::" /* ColonColon */)) {
            this.advance();
            segments.push(this.expectIdentOrType("Expected path segment"));
          }
          if (this.check("(" /* LeftParen */)) {
            this.advance();
            const args = this.parseCallArgs();
            this.expect(")" /* RightParen */, "Expected ')'");
            return {
              kind: "Call",
              callee: { kind: "Path", segments, span: this.spanFrom(start) },
              args,
              span: this.spanFrom(start)
            };
          }
          return { kind: "Path", segments, span: this.spanFrom(start) };
        }
        return { kind: "Ident", name, span: this.spanFrom(start) };
      }
      if (this.check("[" /* LeftBracket */)) {
        this.advance();
        const elements = [];
        if (!this.check("]" /* RightBracket */)) {
          elements.push(this.parseExpr());
          while (this.check("," /* Comma */)) {
            this.advance();
            if (this.check("]" /* RightBracket */)) break;
            elements.push(this.parseExpr());
          }
        }
        this.expect("]" /* RightBracket */, "Expected ']'");
        return { kind: "ArrayLiteral", elements, span: this.spanFrom(start) };
      }
      if (this.check("|" /* Pipe */) || this.check("||" /* Or */)) {
        return this.parseClosureExpr();
      }
      if (this.check("(" /* LeftParen */)) {
        this.advance();
        if (this.check(")" /* RightParen */)) {
          this.advance();
          return { kind: "Ident", name: "()", span: this.spanFrom(start) };
        }
        const expr = this.parseExpr();
        this.expect(")" /* RightParen */, "Expected ')'");
        return expr;
      }
      if (this.check("{" /* LeftBrace */)) {
        const block = this.parseBlock();
        return { kind: "BlockExpr", block, span: this.spanFrom(start) };
      }
      if (this.check("parallel" /* Parallel */)) {
        this.advance();
        const body = this.parseBlock();
        return { kind: "Parallel", body, span: this.spanFrom(start) };
      }
      if (this.check("scope" /* Scope */)) {
        this.advance();
        const name = this.expectIdent("Expected scope variable name");
        this.expect("=" /* Assign */, "Expected '='");
        const initializer = this.parseExpr();
        const body = this.parseBlock();
        return { kind: "Scope", name, initializer, body, span: this.spanFrom(start) };
      }
      this.error(`Unexpected token '${this.current().value}'`);
      this.advance();
      return { kind: "Ident", name: "<error>", span: this.spanFrom(start) };
    }
    parseCallArgs() {
      const args = [];
      if (this.check(")" /* RightParen */)) return args;
      args.push(this.parseCallArg());
      while (this.check("," /* Comma */)) {
        this.advance();
        if (this.check(")" /* RightParen */)) break;
        args.push(this.parseCallArg());
      }
      return args;
    }
    parseCallArg() {
      const start = this.current().span;
      if (this.check("Identifier" /* Identifier */) && this.peekType(1) === ":" /* Colon */) {
        const name = this.advance().value;
        this.advance();
        const value2 = this.parseExpr();
        return { kind: "CallArg", name, value: value2, span: this.spanFrom(start) };
      }
      const value = this.parseExpr();
      return { kind: "CallArg", name: null, value, span: this.spanFrom(start) };
    }
    // ─── String Interpolation ──────────────────────────────────────
    parseStringInterpolation() {
      const start = this.current().span;
      const parts = [];
      const startToken = this.advance();
      if (startToken.value.length > 0) {
        parts.push({ kind: "Literal", value: startToken.value });
      }
      parts.push({ kind: "Expr", expr: this.parseExpr() });
      while (this.check("StringMiddle" /* StringMiddle */)) {
        const mid = this.advance();
        if (mid.value.length > 0) {
          parts.push({ kind: "Literal", value: mid.value });
        }
        parts.push({ kind: "Expr", expr: this.parseExpr() });
      }
      if (this.check("StringEnd" /* StringEnd */)) {
        const end = this.advance();
        if (end.value.length > 0) {
          parts.push({ kind: "Literal", value: end.value });
        }
      } else {
        this.error("Expected end of interpolated string");
      }
      return { kind: "StringInterpolation", parts, span: this.spanFrom(start) };
    }
    // ─── Closure Expression ─────────────────────────────────────────
    parseClosureExpr() {
      const start = this.current().span;
      const params = [];
      if (this.check("||" /* Or */)) {
        this.advance();
      } else {
        this.expect("|" /* Pipe */, "Expected '|'");
        if (!this.check("|" /* Pipe */)) {
          params.push(this.parseClosureParam());
          while (this.check("," /* Comma */)) {
            this.advance();
            if (this.check("|" /* Pipe */)) break;
            params.push(this.parseClosureParam());
          }
        }
        this.expect("|" /* Pipe */, "Expected '|'");
      }
      let returnType = null;
      if (this.check("->" /* Arrow */)) {
        this.advance();
        this.allowRefinement = false;
        returnType = this.parseTypeExpr();
        this.allowRefinement = true;
      }
      let body;
      if (this.check("{" /* LeftBrace */)) {
        body = this.parseBlock();
      } else {
        body = this.parseExpr();
      }
      return {
        kind: "Closure",
        params,
        returnType,
        body,
        span: this.spanFrom(start)
      };
    }
    parseClosureParam() {
      const start = this.current().span;
      const name = this.expectIdent("Expected closure parameter name");
      let typeAnnotation = null;
      if (this.check(":" /* Colon */)) {
        this.advance();
        const prevAllow = this.allowUnionType;
        this.allowUnionType = false;
        typeAnnotation = this.parseTypeExpr();
        this.allowUnionType = prevAllow;
      }
      return { kind: "ClosureParam", name, typeAnnotation, span: this.spanFrom(start) };
    }
    // ─── Operator Precedence ───────────────────────────────────────
    getInfixPrecedence() {
      const t = this.current().type;
      switch (t) {
        case "||" /* Or */:
          return 1;
        case "&&" /* And */:
          return 2;
        case "==" /* Eq */:
        case "!=" /* NotEq */:
          return 3;
        case "<" /* Lt */:
        case ">" /* Gt */:
        case "<=" /* LtEq */:
        case ">=" /* GtEq */:
          return 4;
        case ".." /* DotDot */:
        case "..=" /* DotDotEq */:
          return 5;
        case "+" /* Plus */:
        case "-" /* Minus */:
          return 6;
        case "*" /* Star */:
        case "/" /* Slash */:
        case "%" /* Percent */:
          return 7;
        default:
          return -1;
      }
    }
    // ─── Token Helpers ─────────────────────────────────────────────
    current() {
      return this.tokens[this.pos] ?? {
        type: "EOF" /* EOF */,
        value: "",
        span: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 }, file: "" }
      };
    }
    advance() {
      const token = this.current();
      if (!this.isAtEnd()) this.pos++;
      return token;
    }
    check(type) {
      return this.current().type === type;
    }
    checkIdent(name) {
      return this.current().type === "Identifier" /* Identifier */ && this.current().value === name;
    }
    match(type) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
      return false;
    }
    expect(type, message) {
      if (this.check(type)) {
        return this.advance();
      }
      this.error(message);
      return this.current();
    }
    expectIdent(message) {
      if (this.check("Identifier" /* Identifier */)) {
        return this.advance().value;
      }
      this.error(message);
      return "<error>";
    }
    expectIdentOrType(message) {
      if (this.check("Identifier" /* Identifier */) || this.check("TypeIdentifier" /* TypeIdentifier */)) {
        return this.advance().value;
      }
      this.error(message);
      return "<error>";
    }
    /** Accept identifiers, type identifiers, and keywords usable as path segments */
    expectPathSegment(message) {
      if (this.check("Identifier" /* Identifier */) || this.check("TypeIdentifier" /* TypeIdentifier */)) {
        return this.advance().value;
      }
      const keywordTokens = [
        "shared" /* Shared */,
        "state" /* State */,
        "type" /* Type */,
        "mod" /* Mod */,
        "server" /* Server */,
        "actor" /* Actor */,
        "contract" /* Contract */
      ];
      for (const kw of keywordTokens) {
        if (this.check(kw)) return this.advance().value;
      }
      this.error(message);
      return "<error>";
    }
    peekType(offset) {
      const idx = this.pos + offset;
      if (idx >= this.tokens.length) return "EOF" /* EOF */;
      return this.tokens[idx].type;
    }
    isAtEnd() {
      return this.current().type === "EOF" /* EOF */;
    }
    spanFrom(start) {
      const end = this.pos > 0 ? this.tokens[this.pos - 1].span.end : start.end;
      return { start: start.start, end, file: start.file };
    }
    error(message) {
      const token = this.current();
      this.diagnostics.push(createError(
        "P001",
        message,
        token.span
      ));
    }
    synchronize() {
      this.advance();
      while (!this.isAtEnd()) {
        const t = this.current().type;
        if (t === "fn" /* Fn */ || t === "type" /* Type */ || t === "actor" /* Actor */ || t === "contract" /* Contract */ || t === "server" /* Server */ || t === "component" /* Component */ || t === "use" /* Use */ || t === "mod" /* Mod */ || t === "pub" /* Pub */ || t === "enum" /* Enum */) {
          return;
        }
        if (t === "Annotation" /* Annotation */) return;
        this.advance();
      }
    }
  };

  // src/checker/types.ts
  var PRIMITIVES = /* @__PURE__ */ new Set([
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "u256",
    "f32",
    "f64",
    "bool",
    "String"
  ]);
  var NUMERIC_TYPES = /* @__PURE__ */ new Set([
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "u256",
    "f32",
    "f64"
  ]);
  var INTEGER_TYPES = /* @__PURE__ */ new Set([
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "u256"
  ]);
  var FLOAT_TYPES = /* @__PURE__ */ new Set(["f32", "f64"]);
  function typeEquals(a, b) {
    if (a.kind !== b.kind) return false;
    switch (a.kind) {
      case "Primitive":
        return a.name === b.name;
      case "Unit":
        return true;
      case "Never":
        return true;
      case "Unknown":
        return true;
      case "Struct":
        return a.name === b.name;
      case "Union":
        return a.name === b.name;
      case "Generic": {
        const bg = b;
        return a.name === bg.name && a.args.length === bg.args.length && a.args.every((arg, i) => typeEquals(arg, bg.args[i]));
      }
      case "Function": {
        const bf = b;
        return bf.params.length === a.params.length && a.params.every((p, i) => typeEquals(p, bf.params[i])) && typeEquals(a.ret, bf.ret);
      }
    }
  }
  function typeToString(t) {
    switch (t.kind) {
      case "Primitive":
        return t.name;
      case "Unit":
        return "()";
      case "Unknown":
        return "<unknown>";
      case "Never":
        return "never";
      case "Struct":
        return t.name;
      case "Union":
        return t.name;
      case "Generic":
        return `${t.name}<${t.args.map(typeToString).join(", ")}>`;
      case "Function":
        return `fn(${t.params.map(typeToString).join(", ")}) -> ${typeToString(t.ret)}`;
    }
  }

  // src/checker/environment.ts
  var Environment = class {
    constructor() {
      __publicField(this, "scopes", [{ values: /* @__PURE__ */ new Map(), types: /* @__PURE__ */ new Map() }]);
    }
    define(name, type) {
      this.current().values.set(name, type);
    }
    lookup(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        const t = this.scopes[i].values.get(name);
        if (t !== void 0) return t;
      }
      return void 0;
    }
    defineType(name, type) {
      this.current().types.set(name, type);
    }
    lookupType(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        const t = this.scopes[i].types.get(name);
        if (t !== void 0) return t;
      }
      return void 0;
    }
    enter() {
      this.scopes.push({ values: /* @__PURE__ */ new Map(), types: /* @__PURE__ */ new Map() });
    }
    leave() {
      if (this.scopes.length > 1) {
        this.scopes.pop();
      }
    }
    current() {
      return this.scopes[this.scopes.length - 1];
    }
  };

  // src/checker/builtins.ts
  function registerBuiltins(env) {
    for (const name of PRIMITIVES) {
      env.defineType(name, { kind: "Primitive", name });
    }
    env.defineType("()", { kind: "Unit" });
    env.define("print", {
      kind: "Function",
      params: [{ kind: "Primitive", name: "String" }],
      ret: { kind: "Unit" }
    });
    env.define("println", {
      kind: "Function",
      params: [{ kind: "Primitive", name: "String" }],
      ret: { kind: "Unit" }
    });
  }

  // src/checker/checker.ts
  var COMPARISON_OPS = /* @__PURE__ */ new Set(["==", "!=", "<", ">", "<=", ">="]);
  var LOGICAL_OPS = /* @__PURE__ */ new Set(["&&", "||"]);
  var ARITHMETIC_OPS = /* @__PURE__ */ new Set(["+", "-", "*", "/", "%"]);
  var Checker = class {
    constructor() {
      __publicField(this, "env", new Environment());
      __publicField(this, "diagnostics", []);
      __publicField(this, "currentReturnType", { kind: "Unit" });
    }
    // ─── Main entry point ─────────────────────────────────────────────
    check(program) {
      this.env = new Environment();
      this.diagnostics = [];
      registerBuiltins(this.env);
      for (const item of program.items) {
        this.registerTopLevel(item);
      }
      for (const item of program.items) {
        if (item.kind === "FunctionDecl") {
          this.checkFunction(item);
        }
      }
      return this.diagnostics;
    }
    // ─── Pass 1: Declaration registration ─────────────────────────────
    registerTopLevel(item) {
      switch (item.kind) {
        case "TypeDecl":
          this.registerType(item);
          break;
        case "FunctionDecl":
          this.registerFunction(item);
          break;
        // Phase 1 skips: actors, contracts, servers, components, use, mod
        case "ActorDecl":
        case "ContractDecl":
        case "ServerDecl":
        case "ComponentDecl":
        case "UseDecl":
        case "ModDecl":
        case "StateDecl":
          break;
      }
    }
    registerType(decl) {
      if (this.env.lookupType(decl.name) !== void 0) {
        this.error(`Type '${decl.name}' is already defined`, decl.span);
        return;
      }
      switch (decl.body.kind) {
        case "Alias": {
          const resolved = this.resolveTypeExpr(decl.body.type);
          this.env.defineType(decl.name, resolved);
          break;
        }
        case "Struct": {
          const fields = /* @__PURE__ */ new Map();
          for (const f of decl.body.fields) {
            fields.set(f.name, this.resolveTypeExpr(f.typeAnnotation));
          }
          const structType = { kind: "Struct", name: decl.name, fields };
          this.env.defineType(decl.name, structType);
          break;
        }
        case "Enum": {
          const variants = /* @__PURE__ */ new Map();
          for (const v of decl.body.variants) {
            variants.set(v.name, v.fields && v.fields.length > 0 ? this.resolveTypeExpr(v.fields[0]) : null);
          }
          const unionType = { kind: "Union", name: decl.name, variants };
          this.env.defineType(decl.name, unionType);
          for (const v of decl.body.variants) {
            this.env.define(v.name, unionType);
          }
          break;
        }
      }
    }
    registerFunction(decl) {
      if (this.env.lookup(decl.name) !== void 0) {
        this.error(`Function '${decl.name}' is already defined`, decl.span);
        return;
      }
      const params = decl.params.map((p) => this.resolveTypeExpr(p.typeAnnotation));
      const ret = decl.returnType ? this.resolveTypeExpr(decl.returnType) : { kind: "Unit" };
      this.env.define(decl.name, { kind: "Function", params, ret });
    }
    // ─── Pass 2: Body checking ────────────────────────────────────────
    checkFunction(decl) {
      const fnType = this.env.lookup(decl.name);
      if (!fnType || fnType.kind !== "Function") return;
      this.currentReturnType = fnType.ret;
      this.env.enter();
      for (let i = 0; i < decl.params.length; i++) {
        this.env.define(decl.params[i].name, fnType.params[i]);
      }
      this.checkBlock(decl.body);
      this.env.leave();
    }
    checkBlock(block) {
      for (const stmt of block.statements) {
        this.checkStmt(stmt);
      }
    }
    checkStmt(stmt) {
      switch (stmt.kind) {
        case "LetStmt":
          this.checkLetStmt(stmt);
          break;
        case "ReturnStmt":
          this.checkReturnStmt(stmt);
          break;
        case "IfStmt":
          this.checkIfStmt(stmt);
          break;
        case "ForStmt":
          this.checkForStmt(stmt);
          break;
        case "AssignStmt":
          this.checkAssignStmt(stmt);
          break;
        case "MatchStmt":
          this.checkMatchStmt(stmt);
          break;
        case "ExprStmt":
          this.inferExpr(stmt.expr);
          break;
        // Phase 1 skips: reply, emit, spawn, deploy
        case "ReplyStmt":
        case "EmitStmt":
        case "SpawnStmt":
        case "DeployStmt":
          break;
      }
    }
    // ─── Statement checkers ───────────────────────────────────────────
    checkLetStmt(stmt) {
      if (stmt.typeAnnotation) {
        const annotType = this.resolveTypeExpr(stmt.typeAnnotation);
        const initType = this.inferExpr(stmt.initializer, annotType);
        if (annotType.kind !== "Unknown" && initType.kind !== "Unknown" && !typeEquals(annotType, initType)) {
          this.error(
            `Type mismatch: expected ${typeToString(annotType)}, got ${typeToString(initType)}`,
            stmt.span
          );
        }
        this.env.define(stmt.name, annotType);
      } else {
        const initType = this.inferExpr(stmt.initializer);
        this.env.define(stmt.name, initType);
      }
    }
    checkReturnStmt(stmt) {
      const valType = stmt.value ? this.inferExpr(stmt.value, this.currentReturnType) : { kind: "Unit" };
      if (this.currentReturnType.kind !== "Unknown" && valType.kind !== "Unknown" && !typeEquals(this.currentReturnType, valType)) {
        this.error(
          `Return type mismatch: expected ${typeToString(this.currentReturnType)}, got ${typeToString(valType)}`,
          stmt.span
        );
      }
    }
    checkIfStmt(stmt) {
      const condType = this.inferExpr(stmt.condition);
      if (condType.kind !== "Unknown" && !(condType.kind === "Primitive" && condType.name === "bool")) {
        this.error(
          `If condition must be bool, got ${typeToString(condType)}`,
          stmt.condition.span
        );
      }
      this.env.enter();
      this.checkBlock(stmt.then);
      this.env.leave();
      if (stmt.else_) {
        if (stmt.else_.kind === "IfStmt") {
          this.checkIfStmt(stmt.else_);
        } else {
          this.env.enter();
          this.checkBlock(stmt.else_);
          this.env.leave();
        }
      }
    }
    checkForStmt(stmt) {
      this.inferExpr(stmt.iterable);
      this.env.enter();
      this.env.define(stmt.variable, { kind: "Unknown" });
      this.checkBlock(stmt.body);
      this.env.leave();
    }
    checkAssignStmt(stmt) {
      const targetType = this.inferExpr(stmt.target);
      const valueType = this.inferExpr(stmt.value, targetType);
      if (stmt.operator === "+=" || stmt.operator === "-=") {
        if (targetType.kind === "Primitive" && !NUMERIC_TYPES.has(targetType.name)) {
          this.error(
            `Compound assignment requires numeric type, got ${typeToString(targetType)}`,
            stmt.span
          );
        }
      }
      if (targetType.kind !== "Unknown" && valueType.kind !== "Unknown" && !typeEquals(targetType, valueType)) {
        this.error(
          `Assignment type mismatch: expected ${typeToString(targetType)}, got ${typeToString(valueType)}`,
          stmt.span
        );
      }
    }
    checkMatchStmt(stmt) {
      this.inferExpr(stmt.subject);
      for (const arm of stmt.arms) {
        this.checkMatchArm(arm);
      }
    }
    checkMatchArm(arm) {
      this.env.enter();
      this.bindPattern(arm.pattern);
      if (arm.body.kind === "Block") {
        this.checkBlock(arm.body);
      } else {
        this.inferExpr(arm.body);
      }
      this.env.leave();
    }
    bindPattern(pattern) {
      switch (pattern.kind) {
        case "IdentPattern":
          this.env.define(pattern.name, { kind: "Unknown" });
          break;
        case "ConstructorPattern":
          for (const field of pattern.fields) {
            this.bindPattern(field);
          }
          break;
        case "LiteralPattern":
        case "WildcardPattern":
          break;
      }
    }
    // ─── Expression inference ─────────────────────────────────────────
    inferExpr(expr, expectedType) {
      switch (expr.kind) {
        case "IntLiteral":
          if (expectedType?.kind === "Primitive" && INTEGER_TYPES.has(expectedType.name)) {
            return expectedType;
          }
          return { kind: "Primitive", name: "i64" };
        case "FloatLiteral":
          if (expectedType?.kind === "Primitive" && FLOAT_TYPES.has(expectedType.name)) {
            return expectedType;
          }
          return { kind: "Primitive", name: "f64" };
        case "StringLiteral":
          return { kind: "Primitive", name: "String" };
        case "BoolLiteral":
          return { kind: "Primitive", name: "bool" };
        case "Ident":
          return this.inferIdent(expr);
        case "Binary":
          return this.inferBinary(expr, expectedType);
        case "Unary":
          return this.inferUnary(expr, expectedType);
        case "Call":
          return this.inferCall(expr);
        case "FieldAccess":
          return this.inferFieldAccess(expr);
        case "Index":
          return this.inferIndex(expr);
        case "Struct":
          return this.inferStruct(expr);
        case "IfExpr":
          return this.inferIfExpr(expr);
        case "MacroCall":
          return this.inferMacroCall(expr);
        case "BlockExpr":
          return this.inferBlockExpr(expr);
        case "MatchExpr":
          return this.inferMatchExpr(expr);
        case "Path":
          return this.inferPath(expr);
        // Phase 1 fallbacks
        case "MethodCall":
        case "Parallel":
        case "Scope":
        case "Range":
        case "ArrayLiteral":
        case "Closure":
        case "StringInterpolation":
          return { kind: "Unknown" };
      }
    }
    inferIdent(expr) {
      const t = this.env.lookup(expr.name);
      if (t === void 0) {
        this.error(`Undefined variable '${expr.name}'`, expr.span);
        return { kind: "Unknown" };
      }
      return t;
    }
    inferBinary(expr, expectedType) {
      const numericCtx = ARITHMETIC_OPS.has(expr.operator) ? expectedType : void 0;
      const left = this.inferExpr(expr.left, numericCtx);
      const right = this.inferExpr(expr.right, numericCtx);
      if (COMPARISON_OPS.has(expr.operator)) {
        return { kind: "Primitive", name: "bool" };
      }
      if (LOGICAL_OPS.has(expr.operator)) {
        const boolType = { kind: "Primitive", name: "bool" };
        if (left.kind !== "Unknown" && !typeEquals(left, boolType)) {
          this.error(
            `Logical operator '${expr.operator}' requires bool operands, got ${typeToString(left)}`,
            expr.left.span
          );
        }
        if (right.kind !== "Unknown" && !typeEquals(right, boolType)) {
          this.error(
            `Logical operator '${expr.operator}' requires bool operands, got ${typeToString(right)}`,
            expr.right.span
          );
        }
        return boolType;
      }
      if (ARITHMETIC_OPS.has(expr.operator)) {
        if (left.kind !== "Unknown" && right.kind !== "Unknown" && !typeEquals(left, right)) {
          this.error(
            `Arithmetic operands must have same type: ${typeToString(left)} vs ${typeToString(right)}`,
            expr.span
          );
        }
        if (left.kind === "Primitive" && NUMERIC_TYPES.has(left.name)) return left;
        if (right.kind === "Primitive" && NUMERIC_TYPES.has(right.name)) return right;
        if (expr.operator === "+" && left.kind === "Primitive" && left.name === "String") return left;
        return left.kind !== "Unknown" ? left : right;
      }
      return left.kind !== "Unknown" ? left : right;
    }
    inferUnary(expr, expectedType) {
      const operandType = this.inferExpr(expr.operand, expr.operator === "-" ? expectedType : void 0);
      if (expr.operator === "!") {
        const boolType = { kind: "Primitive", name: "bool" };
        if (operandType.kind !== "Unknown" && !typeEquals(operandType, boolType)) {
          this.error(
            `Unary '!' requires bool, got ${typeToString(operandType)}`,
            expr.operand.span
          );
        }
        return boolType;
      }
      if (expr.operator === "-") {
        return operandType;
      }
      return operandType;
    }
    inferCall(expr) {
      const calleeType = this.inferExpr(expr.callee);
      if (calleeType.kind === "Unknown") {
        for (const arg of expr.args) {
          this.inferExpr(arg.value);
        }
        return { kind: "Unknown" };
      }
      if (calleeType.kind !== "Function") {
        this.error(
          `Cannot call non-function type ${typeToString(calleeType)}`,
          expr.callee.span
        );
        for (const arg of expr.args) {
          this.inferExpr(arg.value);
        }
        return { kind: "Unknown" };
      }
      if (expr.args.length !== calleeType.params.length) {
        this.error(
          `Expected ${calleeType.params.length} argument(s), got ${expr.args.length}`,
          expr.span
        );
      }
      for (let i = 0; i < expr.args.length; i++) {
        const paramType = i < calleeType.params.length ? calleeType.params[i] : void 0;
        const argType = this.inferExpr(expr.args[i].value, paramType);
        if (paramType && paramType.kind !== "Unknown" && argType.kind !== "Unknown" && !typeEquals(paramType, argType)) {
          this.error(
            `Argument type mismatch: expected ${typeToString(paramType)}, got ${typeToString(argType)}`,
            expr.args[i].span
          );
        }
      }
      return calleeType.ret;
    }
    inferFieldAccess(expr) {
      const objType = this.inferExpr(expr.object);
      if (objType.kind === "Unknown") return { kind: "Unknown" };
      if (objType.kind === "Struct") {
        const fieldType = objType.fields.get(expr.field);
        if (fieldType === void 0) {
          this.error(
            `Type '${objType.name}' has no field '${expr.field}'`,
            expr.span
          );
          return { kind: "Unknown" };
        }
        return fieldType;
      }
      return { kind: "Unknown" };
    }
    inferIndex(expr) {
      this.inferExpr(expr.object);
      this.inferExpr(expr.index);
      return { kind: "Unknown" };
    }
    inferStruct(expr) {
      const t = this.env.lookupType(expr.name);
      if (t === void 0) {
        this.error(`Undefined type '${expr.name}'`, expr.span);
        for (const f of expr.fields) {
          this.inferExpr(f.value);
        }
        return { kind: "Unknown" };
      }
      if (t.kind !== "Struct") {
        this.error(`'${expr.name}' is not a struct type`, expr.span);
        for (const f of expr.fields) {
          this.inferExpr(f.value);
        }
        return { kind: "Unknown" };
      }
      for (const f of expr.fields) {
        const fieldType = t.fields.get(f.name);
        if (fieldType === void 0) {
          this.error(
            `Type '${expr.name}' has no field '${f.name}'`,
            f.span
          );
          this.inferExpr(f.value);
          continue;
        }
        const valType = this.inferExpr(f.value, fieldType);
        if (fieldType.kind !== "Unknown" && valType.kind !== "Unknown" && !typeEquals(fieldType, valType)) {
          this.error(
            `Field '${f.name}' expects ${typeToString(fieldType)}, got ${typeToString(valType)}`,
            f.span
          );
        }
      }
      return t;
    }
    inferIfExpr(expr) {
      const condType = this.inferExpr(expr.condition);
      if (condType.kind !== "Unknown" && !(condType.kind === "Primitive" && condType.name === "bool")) {
        this.error(
          `If condition must be bool, got ${typeToString(condType)}`,
          expr.condition.span
        );
      }
      this.env.enter();
      this.checkBlock(expr.then);
      this.env.leave();
      if (expr.else_) {
        if (expr.else_.kind === "IfExpr") {
          this.inferIfExpr(expr.else_);
        } else {
          this.env.enter();
          this.checkBlock(expr.else_);
          this.env.leave();
        }
      }
      return { kind: "Unknown" };
    }
    inferMacroCall(expr) {
      for (const arg of expr.args) {
        this.inferExpr(arg);
      }
      const mathMacros = [
        "math_sin",
        "math_cos",
        "math_tan",
        "math_sqrt",
        "math_floor",
        "math_abs",
        "math_atan2",
        "math_min",
        "math_max",
        "math_round",
        "math_random"
      ];
      if (mathMacros.includes(expr.name)) {
        return { kind: "Primitive", name: "f64" };
      }
      return { kind: "Unit" };
    }
    inferBlockExpr(expr) {
      this.env.enter();
      this.checkBlock(expr.block);
      this.env.leave();
      return { kind: "Unknown" };
    }
    inferMatchExpr(expr) {
      this.inferExpr(expr.subject);
      for (const arm of expr.arms) {
        this.checkMatchArm(arm);
      }
      return { kind: "Unknown" };
    }
    inferPath(expr) {
      const fullName = expr.segments.join("::");
      const last = expr.segments[expr.segments.length - 1];
      const t = this.env.lookup(last) ?? this.env.lookup(fullName);
      if (t !== void 0) return t;
      return { kind: "Unknown" };
    }
    // ─── Type resolution ──────────────────────────────────────────────
    resolveTypeExpr(texpr) {
      switch (texpr.kind) {
        case "NamedType": {
          const t = this.env.lookupType(texpr.name);
          if (t === void 0) {
            this.error(`Undefined type '${texpr.name}'`, texpr.span);
            return { kind: "Unknown" };
          }
          return t;
        }
        case "GenericType": {
          const args = texpr.typeArgs.map((a) => this.resolveTypeExpr(a));
          return { kind: "Generic", name: texpr.name, args };
        }
        case "RefinedType":
          return this.resolveTypeExpr(texpr.baseType);
        case "FunctionType": {
          const params = texpr.params.map((p) => this.resolveTypeExpr(p));
          const ret = this.resolveTypeExpr(texpr.returnType);
          return { kind: "Function", params, ret };
        }
        case "UnionType":
          return { kind: "Unknown" };
        case "ReferenceType":
          return this.resolveTypeExpr(texpr.inner);
        case "OwnType":
          return this.resolveTypeExpr(texpr.inner);
        case "SharedType":
          return this.resolveTypeExpr(texpr.inner);
      }
    }
    // ─── Error helper ─────────────────────────────────────────────────
    error(message, span) {
      this.diagnostics.push(createError("E_TYPE", message, span));
    }
  };

  // src/semantic/scope.ts
  var SymbolTable = class {
    constructor() {
      __publicField(this, "scopes", [{ values: /* @__PURE__ */ new Map(), types: /* @__PURE__ */ new Map() }]);
    }
    // ── Values (variables, functions, parameters) ─────────────────
    /**
     * Define a value symbol in the current scope.
     * Returns false if a symbol with the same name already exists
     * in the *current* (innermost) scope.
     */
    defineValue(info) {
      const current = this.currentScope();
      if (current.values.has(info.name)) {
        return false;
      }
      current.values.set(info.name, info);
      return true;
    }
    /**
     * Look up a value by name, searching from innermost to outermost scope.
     */
    lookupValue(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        const info = this.scopes[i].values.get(name);
        if (info !== void 0) return info;
      }
      return void 0;
    }
    /**
     * Check whether a value exists in the *current* (innermost) scope only.
     */
    hasValueInCurrentScope(name) {
      return this.currentScope().values.has(name);
    }
    // ── Types (struct, enum, alias, actor, contract) ──────────────
    /**
     * Define a type symbol in the current scope.
     * Returns false if already defined in the current scope.
     */
    defineType(info) {
      const current = this.currentScope();
      if (current.types.has(info.name)) {
        return false;
      }
      current.types.set(info.name, info);
      return true;
    }
    /**
     * Look up a type by name, searching from innermost to outermost scope.
     */
    lookupType(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        const info = this.scopes[i].types.get(name);
        if (info !== void 0) return info;
      }
      return void 0;
    }
    // ── Scope management ──────────────────────────────────────────
    enter() {
      this.scopes.push({ values: /* @__PURE__ */ new Map(), types: /* @__PURE__ */ new Map() });
    }
    leave() {
      if (this.scopes.length > 1) {
        this.scopes.pop();
      }
    }
    get depth() {
      return this.scopes.length;
    }
    currentScope() {
      return this.scopes[this.scopes.length - 1];
    }
  };

  // src/semantic/resolver.ts
  var BUILTIN_TYPES = /* @__PURE__ */ new Set([
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "u256",
    "f32",
    "f64",
    "bool",
    "String"
  ]);
  var BUILTIN_FUNCTIONS = /* @__PURE__ */ new Set([
    "print",
    "println"
  ]);
  var BUILTIN_SPAN = {
    start: { line: 0, column: 0, offset: 0 },
    end: { line: 0, column: 0, offset: 0 },
    file: "<builtin>"
  };
  var Resolver = class {
    constructor() {
      __publicField(this, "symbols", new SymbolTable());
      __publicField(this, "diagnostics", []);
    }
    // ── Main entry point ──────────────────────────────────────────
    resolve(program) {
      this.symbols = new SymbolTable();
      this.diagnostics = [];
      this.registerBuiltins();
      for (const item of program.items) {
        this.registerTopLevel(item);
      }
      for (const item of program.items) {
        this.resolveTopLevel(item);
      }
      return this.diagnostics;
    }
    // ── Builtins ──────────────────────────────────────────────────
    registerBuiltins() {
      for (const name of BUILTIN_TYPES) {
        this.symbols.defineType({
          name,
          symbolKind: "builtin",
          span: BUILTIN_SPAN,
          mutable: false
        });
      }
      this.symbols.defineType({
        name: "()",
        symbolKind: "builtin",
        span: BUILTIN_SPAN,
        mutable: false
      });
      for (const name of BUILTIN_FUNCTIONS) {
        this.symbols.defineValue({
          name,
          symbolKind: "builtin",
          span: BUILTIN_SPAN,
          mutable: false
        });
      }
    }
    // ── Pass 1: Top-level registration ────────────────────────────
    registerTopLevel(item) {
      switch (item.kind) {
        case "FunctionDecl":
          this.registerFunction(item);
          break;
        case "TypeDecl":
          this.registerTypeDecl(item);
          break;
        case "ActorDecl":
          this.registerActor(item);
          break;
        case "ContractDecl":
          this.registerContract(item);
          break;
        case "ServerDecl":
          this.registerServer(item);
          break;
        case "ComponentDecl":
          this.registerComponent(item);
          break;
        case "StateDecl":
          this.registerState(item);
          break;
        case "EnumDecl":
          this.registerEnumDecl(item);
          break;
        case "UseDecl":
        case "ModDecl":
          break;
      }
    }
    registerFunction(decl) {
      const ok = this.symbols.defineValue({
        name: decl.name,
        symbolKind: "function",
        span: decl.span,
        mutable: false
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${decl.name}' is already defined in this scope`,
          decl.span
        );
      }
    }
    registerTypeDecl(decl) {
      const fields = [];
      if (decl.body.kind === "Struct") {
        for (const f of decl.body.fields) {
          fields.push(f.name);
        }
      }
      const symbolKind = decl.body.kind === "Struct" ? "struct" : decl.body.kind === "Enum" ? "enum" : "type";
      const ok = this.symbols.defineType({
        name: decl.name,
        symbolKind,
        span: decl.span,
        mutable: false,
        fields: fields.length > 0 ? fields : void 0
      });
      if (!ok) {
        this.error(
          `Duplicate type declaration: '${decl.name}' is already defined`,
          decl.span
        );
      }
      if (decl.body.kind === "Enum") {
        for (const v of decl.body.variants) {
          this.symbols.defineValue({
            name: v.name,
            symbolKind: "variant",
            span: v.span,
            mutable: false
          });
        }
      }
    }
    registerActor(decl) {
      const members = [];
      for (const m of decl.members) {
        if (m.kind === "StateDecl") members.push(m.name);
        if (m.kind === "OnHandler") members.push(m.messageName);
        if (m.kind === "FunctionDecl") members.push(m.name);
      }
      const ok = this.symbols.defineType({
        name: decl.name,
        symbolKind: "actor",
        span: decl.span,
        mutable: false,
        members
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${decl.name}' is already defined`,
          decl.span
        );
      }
      this.symbols.defineValue({
        name: decl.name,
        symbolKind: "actor",
        span: decl.span,
        mutable: false,
        members
      });
    }
    registerContract(decl) {
      const ok = this.symbols.defineType({
        name: decl.name,
        symbolKind: "contract",
        span: decl.span,
        mutable: false
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${decl.name}' is already defined`,
          decl.span
        );
      }
    }
    registerServer(decl) {
      const ok = this.symbols.defineType({
        name: decl.name,
        symbolKind: "server",
        span: decl.span,
        mutable: false
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${decl.name}' is already defined`,
          decl.span
        );
      }
    }
    registerComponent(decl) {
      const ok = this.symbols.defineType({
        name: decl.name,
        symbolKind: "component",
        span: decl.span,
        mutable: false
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${decl.name}' is already defined`,
          decl.span
        );
      }
    }
    registerState(decl) {
      const ok = this.symbols.defineValue({
        name: decl.name,
        symbolKind: "state",
        span: decl.span,
        mutable: true
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${decl.name}' is already defined in this scope`,
          decl.span
        );
      }
    }
    registerEnumDecl(decl) {
      const ok = this.symbols.defineType({
        name: decl.name,
        symbolKind: "enum",
        span: decl.span,
        mutable: false
      });
      if (!ok) {
        this.error(
          `Duplicate type declaration: '${decl.name}' is already defined`,
          decl.span
        );
      }
      for (const v of decl.variants) {
        this.symbols.defineValue({
          name: v.name,
          symbolKind: "variant",
          span: v.span,
          mutable: false
        });
      }
    }
    // ── Pass 2: Resolve bodies ────────────────────────────────────
    resolveTopLevel(item) {
      switch (item.kind) {
        case "FunctionDecl":
          this.resolveFunction(item);
          break;
        case "TypeDecl":
          this.resolveTypeDecl(item);
          break;
        case "ActorDecl":
          this.resolveActor(item);
          break;
        case "ContractDecl":
          this.resolveContract(item);
          break;
        case "ServerDecl":
          this.resolveServer(item);
          break;
        case "ComponentDecl":
          this.resolveComponentDecl(item);
          break;
        case "StateDecl":
          if (item.initializer) {
            this.resolveExpr(item.initializer);
          }
          this.resolveTypeRef(item.typeAnnotation);
          break;
        case "EnumDecl":
          this.resolveEnumDecl(item);
          break;
        case "UseDecl":
        case "ModDecl":
          break;
      }
    }
    // ── Functions ─────────────────────────────────────────────────
    resolveFunction(decl) {
      this.symbols.enter();
      for (const param of decl.params) {
        this.resolveTypeRef(param.typeAnnotation);
        const ok = this.symbols.defineValue({
          name: param.name,
          symbolKind: "parameter",
          span: param.span,
          mutable: false
        });
        if (!ok) {
          this.error(
            `Duplicate parameter name: '${param.name}'`,
            param.span
          );
        }
      }
      if (decl.returnType) {
        this.resolveTypeRef(decl.returnType);
      }
      this.resolveBlock(decl.body);
      this.symbols.leave();
    }
    // ── Type declarations ─────────────────────────────────────────
    resolveTypeDecl(decl) {
      switch (decl.body.kind) {
        case "Alias":
          this.resolveTypeRef(decl.body.type);
          break;
        case "Struct":
          for (const field of decl.body.fields) {
            this.resolveTypeRef(field.typeAnnotation);
            if (field.defaultValue) {
              this.resolveExpr(field.defaultValue);
            }
          }
          break;
        case "Enum":
          for (const variant of decl.body.variants) {
            if (variant.fields) {
              for (const field of variant.fields) {
                this.resolveTypeRef(field);
              }
            }
          }
          break;
      }
    }
    // ── Enum declarations ──────────────────────────────────────────
    resolveEnumDecl(decl) {
      for (const variant of decl.variants) {
        switch (variant.kind) {
          case "UnitVariant":
            break;
          case "TupleVariant":
            for (const field of variant.fields) {
              this.resolveTypeRef(field);
            }
            break;
          case "StructVariant":
            for (const field of variant.fields) {
              this.resolveTypeRef(field.typeAnnotation);
            }
            break;
        }
      }
    }
    // ── Actors ────────────────────────────────────────────────────
    resolveActor(decl) {
      this.symbols.enter();
      for (const member of decl.members) {
        switch (member.kind) {
          case "StateDecl":
            this.symbols.defineValue({
              name: member.name,
              symbolKind: "state",
              span: member.span,
              mutable: true
            });
            break;
          case "FunctionDecl":
            this.symbols.defineValue({
              name: member.name,
              symbolKind: "function",
              span: member.span,
              mutable: false
            });
            break;
          case "OnHandler":
          case "SuperviseDecl":
          case "InitDecl":
            break;
        }
      }
      for (const member of decl.members) {
        switch (member.kind) {
          case "StateDecl":
            this.resolveTypeRef(member.typeAnnotation);
            if (member.initializer) {
              this.resolveExpr(member.initializer);
            }
            break;
          case "FunctionDecl":
            this.resolveFunction(member);
            break;
          case "OnHandler":
            this.resolveOnHandler(member);
            break;
          case "InitDecl":
            this.resolveInitDecl(member);
            break;
          case "SuperviseDecl":
            for (const opt of member.options) {
              this.resolveExpr(opt.value);
            }
            break;
        }
      }
      this.symbols.leave();
    }
    resolveOnHandler(handler) {
      this.symbols.enter();
      for (const param of handler.params) {
        this.resolveTypeRef(param.typeAnnotation);
        this.symbols.defineValue({
          name: param.name,
          symbolKind: "parameter",
          span: param.span,
          mutable: false
        });
      }
      if (handler.returnType) {
        this.resolveTypeRef(handler.returnType);
      }
      this.resolveBlock(handler.body);
      this.symbols.leave();
    }
    resolveInitDecl(init) {
      this.symbols.enter();
      for (const param of init.params) {
        this.resolveTypeRef(param.typeAnnotation);
        this.symbols.defineValue({
          name: param.name,
          symbolKind: "parameter",
          span: param.span,
          mutable: false
        });
      }
      this.resolveBlock(init.body);
      this.symbols.leave();
    }
    // ── Contracts ─────────────────────────────────────────────────
    resolveContract(decl) {
      this.symbols.enter();
      for (const member of decl.members) {
        switch (member.kind) {
          case "StateDecl":
            this.symbols.defineValue({
              name: member.name,
              symbolKind: "state",
              span: member.span,
              mutable: true
            });
            break;
          case "FunctionDecl":
            this.symbols.defineValue({
              name: member.name,
              symbolKind: "function",
              span: member.span,
              mutable: false
            });
            break;
          case "InitDecl":
            break;
        }
      }
      for (const member of decl.members) {
        switch (member.kind) {
          case "StateDecl":
            this.resolveTypeRef(member.typeAnnotation);
            if (member.initializer) {
              this.resolveExpr(member.initializer);
            }
            break;
          case "FunctionDecl":
            this.resolveFunction(member);
            break;
          case "InitDecl":
            this.resolveInitDecl(member);
            break;
        }
      }
      this.symbols.leave();
    }
    // ── Servers ───────────────────────────────────────────────────
    resolveServer(decl) {
      this.symbols.enter();
      for (const member of decl.members) {
        switch (member.kind) {
          case "FunctionDecl":
            this.symbols.defineValue({
              name: member.name,
              symbolKind: "function",
              span: member.span,
              mutable: false
            });
            break;
          case "StateDecl":
            this.symbols.defineValue({
              name: member.name,
              symbolKind: "state",
              span: member.span,
              mutable: true
            });
            break;
          case "FieldAssignment":
            break;
        }
      }
      for (const member of decl.members) {
        switch (member.kind) {
          case "FunctionDecl":
            this.resolveFunction(member);
            break;
          case "StateDecl":
            this.resolveTypeRef(member.typeAnnotation);
            if (member.initializer) {
              this.resolveExpr(member.initializer);
            }
            break;
          case "FieldAssignment":
            this.resolveExpr(member.value);
            break;
        }
      }
      this.symbols.leave();
    }
    // ── Components ────────────────────────────────────────────────
    resolveComponentDecl(decl) {
      this.symbols.enter();
      for (const param of decl.params) {
        this.resolveTypeRef(param.typeAnnotation);
        this.symbols.defineValue({
          name: param.name,
          symbolKind: "parameter",
          span: param.span,
          mutable: false
        });
      }
      this.resolveBlock(decl.body);
      this.symbols.leave();
    }
    // ── Blocks & Statements ───────────────────────────────────────
    resolveBlock(block) {
      for (const stmt of block.statements) {
        this.resolveStmt(stmt);
      }
    }
    resolveStmt(stmt) {
      switch (stmt.kind) {
        case "LetStmt":
          this.resolveLetStmt(stmt);
          break;
        case "ReturnStmt":
          if (stmt.value) {
            this.resolveExpr(stmt.value);
          }
          break;
        case "ReplyStmt":
          this.resolveExpr(stmt.value);
          break;
        case "EmitStmt":
          for (const arg of stmt.args) {
            this.resolveExpr(arg);
          }
          break;
        case "ExprStmt":
          this.resolveExpr(stmt.expr);
          break;
        case "IfStmt":
          this.resolveIfStmt(stmt);
          break;
        case "ForStmt":
          this.resolveForStmt(stmt);
          break;
        case "WhileStmt":
          this.resolveExpr(stmt.condition);
          this.symbols.enter();
          this.resolveBlock(stmt.body);
          this.symbols.leave();
          break;
        case "MatchStmt":
          this.resolveMatchStmt(stmt);
          break;
        case "AssignStmt":
          this.resolveExpr(stmt.target);
          this.resolveExpr(stmt.value);
          break;
        case "SpawnStmt":
          if (!this.symbols.lookupType(stmt.actor) && !this.symbols.lookupValue(stmt.actor)) {
            this.error(`Undeclared actor '${stmt.actor}'`, stmt.span);
          }
          for (const arg of stmt.args) {
            this.resolveExpr(arg);
          }
          break;
        case "DeployStmt":
          if (!this.symbols.lookupType(stmt.contract) && !this.symbols.lookupValue(stmt.contract)) {
            this.error(`Undeclared contract '${stmt.contract}'`, stmt.span);
          }
          for (const arg of stmt.args) {
            this.resolveExpr(arg.value);
          }
          break;
      }
    }
    resolveLetStmt(stmt) {
      this.resolveExpr(stmt.initializer);
      if (stmt.typeAnnotation) {
        this.resolveTypeRef(stmt.typeAnnotation);
      }
      const ok = this.symbols.defineValue({
        name: stmt.name,
        symbolKind: "variable",
        span: stmt.span,
        mutable: stmt.mutable
      });
      if (!ok) {
        this.error(
          `Duplicate declaration: '${stmt.name}' is already defined in this scope`,
          stmt.span
        );
      }
    }
    resolveIfStmt(stmt) {
      this.resolveExpr(stmt.condition);
      this.symbols.enter();
      this.resolveBlock(stmt.then);
      this.symbols.leave();
      if (stmt.else_) {
        if (stmt.else_.kind === "IfStmt") {
          this.resolveIfStmt(stmt.else_);
        } else {
          this.symbols.enter();
          this.resolveBlock(stmt.else_);
          this.symbols.leave();
        }
      }
    }
    resolveForStmt(stmt) {
      this.resolveExpr(stmt.iterable);
      this.symbols.enter();
      this.symbols.defineValue({
        name: stmt.variable,
        symbolKind: "for-variable",
        span: stmt.span,
        mutable: false
      });
      this.resolveBlock(stmt.body);
      this.symbols.leave();
    }
    resolveMatchStmt(stmt) {
      this.resolveExpr(stmt.subject);
      for (const arm of stmt.arms) {
        this.resolveMatchArm(arm);
      }
    }
    resolveMatchArm(arm) {
      this.symbols.enter();
      this.resolvePattern(arm.pattern);
      if (arm.body.kind === "Block") {
        this.resolveBlock(arm.body);
      } else {
        this.resolveExpr(arm.body);
      }
      this.symbols.leave();
    }
    resolvePattern(pattern) {
      switch (pattern.kind) {
        case "IdentPattern":
          this.symbols.defineValue({
            name: pattern.name,
            symbolKind: "match-binding",
            span: pattern.span,
            mutable: false
          });
          break;
        case "ConstructorPattern":
          for (const field of pattern.fields) {
            this.resolvePattern(field);
          }
          break;
        case "LiteralPattern":
        case "WildcardPattern":
          break;
      }
    }
    // ── Expressions ───────────────────────────────────────────────
    resolveExpr(expr) {
      switch (expr.kind) {
        case "Ident":
          this.resolveIdent(expr);
          break;
        case "IntLiteral":
        case "FloatLiteral":
        case "StringLiteral":
        case "BoolLiteral":
          break;
        case "Binary":
          this.resolveExpr(expr.left);
          this.resolveExpr(expr.right);
          break;
        case "Unary":
          this.resolveExpr(expr.operand);
          break;
        case "Call":
          this.resolveExpr(expr.callee);
          for (const arg of expr.args) {
            this.resolveExpr(arg.value);
          }
          break;
        case "MethodCall":
          this.resolveExpr(expr.object);
          for (const arg of expr.args) {
            this.resolveExpr(arg.value);
          }
          break;
        case "FieldAccess":
          this.resolveFieldAccess(expr);
          break;
        case "Index":
          this.resolveExpr(expr.object);
          this.resolveExpr(expr.index);
          break;
        case "Struct":
          this.resolveStructExpr(expr);
          break;
        case "BlockExpr":
          this.symbols.enter();
          this.resolveBlock(expr.block);
          this.symbols.leave();
          break;
        case "IfExpr":
          this.resolveIfExpr(expr);
          break;
        case "MatchExpr":
          this.resolveExpr(expr.subject);
          for (const arm of expr.arms) {
            this.resolveMatchArm(arm);
          }
          break;
        case "Parallel":
          this.symbols.enter();
          this.resolveBlock(expr.body);
          this.symbols.leave();
          break;
        case "Scope":
          this.resolveExpr(expr.initializer);
          this.symbols.enter();
          this.symbols.defineValue({
            name: expr.name,
            symbolKind: "variable",
            span: expr.span,
            mutable: false
          });
          this.resolveBlock(expr.body);
          this.symbols.leave();
          break;
        case "MacroCall":
          for (const arg of expr.args) {
            this.resolveExpr(arg);
          }
          break;
        case "Path":
          this.resolvePath(expr);
          break;
        case "Range":
          if (expr.start) this.resolveExpr(expr.start);
          if (expr.end) this.resolveExpr(expr.end);
          break;
        case "ArrayLiteral":
          for (const el of expr.elements) {
            this.resolveExpr(el);
          }
          break;
        case "Closure":
          this.resolveClosure(expr);
          break;
      }
    }
    resolveIdent(expr) {
      const info = this.symbols.lookupValue(expr.name);
      if (info === void 0) {
        this.error(
          `Undeclared variable '${expr.name}'`,
          expr.span,
          { suggestion: `Did you mean to declare '${expr.name}' with 'let'?` }
        );
      }
    }
    resolveFieldAccess(expr) {
      this.resolveExpr(expr.object);
      if (expr.object.kind === "Ident") {
        const valInfo = this.symbols.lookupValue(expr.object.name);
      }
    }
    resolveStructExpr(expr) {
      const typeInfo = this.symbols.lookupType(expr.name);
      if (typeInfo === void 0) {
        this.error(`Undeclared type '${expr.name}'`, expr.span);
      } else if (typeInfo.symbolKind === "struct" && typeInfo.fields) {
        const knownFields = new Set(typeInfo.fields);
        for (const f of expr.fields) {
          if (!knownFields.has(f.name)) {
            this.error(
              `Struct '${expr.name}' has no field named '${f.name}'`,
              f.span
            );
          }
        }
      }
      for (const f of expr.fields) {
        this.resolveExpr(f.value);
      }
    }
    resolveIfExpr(expr) {
      this.resolveExpr(expr.condition);
      this.symbols.enter();
      this.resolveBlock(expr.then);
      this.symbols.leave();
      if (expr.else_) {
        if (expr.else_.kind === "IfExpr") {
          this.resolveIfExpr(expr.else_);
        } else {
          this.symbols.enter();
          this.resolveBlock(expr.else_);
          this.symbols.leave();
        }
      }
    }
    resolvePath(expr) {
      if (expr.segments.length > 0) {
        const first = expr.segments[0];
        const asValue = this.symbols.lookupValue(first);
        const asType = this.symbols.lookupType(first);
        if (!asValue && !asType) {
        }
      }
    }
    resolveClosure(expr) {
      this.symbols.enter();
      for (const param of expr.params) {
        if (param.typeAnnotation) {
          this.resolveTypeRef(param.typeAnnotation);
        }
        this.symbols.defineValue({
          name: param.name,
          symbolKind: "parameter",
          span: param.span,
          mutable: false
        });
      }
      if (expr.returnType) {
        this.resolveTypeRef(expr.returnType);
      }
      if ("kind" in expr.body && expr.body.kind === "Block") {
        this.resolveBlock(expr.body);
      } else {
        this.resolveExpr(expr.body);
      }
      this.symbols.leave();
    }
    // ── Type references ───────────────────────────────────────────
    resolveTypeRef(texpr) {
      switch (texpr.kind) {
        case "NamedType": {
          const info = this.symbols.lookupType(texpr.name);
          if (info === void 0) {
            this.error(`Undeclared type '${texpr.name}'`, texpr.span);
          }
          break;
        }
        case "GenericType": {
          const info = this.symbols.lookupType(texpr.name);
          if (info === void 0) {
          }
          for (const arg of texpr.typeArgs) {
            this.resolveTypeRef(arg);
          }
          break;
        }
        case "RefinedType":
          this.resolveTypeRef(texpr.baseType);
          break;
        case "FunctionType":
          for (const param of texpr.params) {
            this.resolveTypeRef(param);
          }
          this.resolveTypeRef(texpr.returnType);
          break;
        case "UnionType":
          for (const t of texpr.types) {
            this.resolveTypeRef(t);
          }
          break;
        case "ReferenceType":
          this.resolveTypeRef(texpr.inner);
          break;
        case "OwnType":
          this.resolveTypeRef(texpr.inner);
          break;
        case "SharedType":
          this.resolveTypeRef(texpr.inner);
          break;
        case "ArrayType":
          this.resolveTypeRef(texpr.elementType);
          break;
      }
    }
    // ── Diagnostics ───────────────────────────────────────────────
    error(message, span, options = {}) {
      this.diagnostics.push(createError("E_NAME", message, span, options));
    }
  };

  // src/codegen/jsgen.ts
  var JsGenerator = class {
    constructor() {
      __publicField(this, "output", "");
      __publicField(this, "indent", 0);
      __publicField(this, "classStateFields", /* @__PURE__ */ new Set());
      __publicField(this, "classNames", /* @__PURE__ */ new Set());
    }
    // ─── Main entry point ─────────────────────────────────────────────
    generate(program) {
      this.output = "";
      this.indent = 0;
      this.classNames = /* @__PURE__ */ new Set();
      for (const item of program.items) {
        if (item.kind === "ActorDecl" || item.kind === "ContractDecl" || item.kind === "ServerDecl" || item.kind === "ComponentDecl") {
          this.classNames.add(item.name);
        }
      }
      for (let i = 0; i < program.items.length; i++) {
        this.emitTopLevel(program.items[i]);
        if (i < program.items.length - 1) {
          this.writeLine("");
        }
      }
      return this.output;
    }
    // ─── Top-level items ─────────────────────────────────────────────
    emitTopLevel(item) {
      switch (item.kind) {
        case "FunctionDecl":
          this.emitFunction(item);
          break;
        case "TypeDecl":
          this.emitTypeDecl(item);
          break;
        case "EnumDecl":
          this.emitEnumDecl(item);
          break;
        case "ActorDecl":
          this.emitActorDecl(item);
          break;
        case "ContractDecl":
          this.emitContractDecl(item);
          break;
        case "ServerDecl":
          this.emitServerDecl(item);
          break;
        case "ComponentDecl":
          this.emitComponentDecl(item);
          break;
        case "UseDecl":
          this.emitUseDecl(item);
          break;
        case "ModDecl":
          this.emitModDecl(item);
          break;
        case "StateDecl":
          this.emitStateDecl(item);
          break;
      }
    }
    // ─── Declarations ─────────────────────────────────────────────────
    emitFunction(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const asyncPrefix = decl.isAsync ? "async " : "";
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      const params = decl.params.map((p) => p.name).join(", ");
      this.writeLine(`${exportPrefix}${asyncPrefix}function ${decl.name}(${params}) {`);
      this.emitBlockBody(decl.body);
      this.writeLine("}");
    }
    emitTypeDecl(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      switch (decl.body.kind) {
        case "Alias":
          this.writeLine(`/* type ${decl.name} = ... (alias) */`);
          break;
        case "Struct": {
          const fields = decl.body.fields;
          const fieldNames = fields.map((f) => f.name);
          this.writeLine(`${exportPrefix}class ${decl.name} {`);
          this.indentInc();
          this.writeLine(`constructor(${fieldNames.join(", ")}) {`);
          this.indentInc();
          for (const f of fieldNames) {
            this.writeLine(`this.${f} = ${f};`);
          }
          this.indentDec();
          this.writeLine("}");
          this.indentDec();
          this.writeLine("}");
          break;
        }
        case "Enum": {
          const variants = decl.body.variants;
          this.writeLine(`${exportPrefix}const ${decl.name} = Object.freeze({`);
          this.indentInc();
          for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const comma = i < variants.length - 1 ? "," : "";
            this.writeLine(`${v.name}: "${v.name}"${comma}`);
          }
          this.indentDec();
          this.writeLine("});");
          break;
        }
      }
    }
    emitEnumDecl(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      this.writeLine(`${exportPrefix}const ${decl.name} = Object.freeze({`);
      this.indentInc();
      for (let i = 0; i < decl.variants.length; i++) {
        const v = decl.variants[i];
        const comma = i < decl.variants.length - 1 ? "," : "";
        this.emitEnumVariant(v, comma);
      }
      this.indentDec();
      this.writeLine("});");
    }
    emitEnumVariant(variant, comma) {
      switch (variant.kind) {
        case "UnitVariant":
          this.writeLine(`${variant.name}: "${variant.name}"${comma}`);
          break;
        case "TupleVariant":
          this.writeLine(`${variant.name}: (...args) => ({ tag: "${variant.name}", values: args })${comma}`);
          break;
        case "StructVariant":
          this.writeLine(`${variant.name}: (fields) => ({ tag: "${variant.name}", ...fields })${comma}`);
          break;
      }
    }
    emitActorDecl(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      const stateMembers = decl.members.filter((m) => m.kind === "StateDecl");
      const onHandlers = decl.members.filter((m) => m.kind === "OnHandler");
      const functions = decl.members.filter((m) => m.kind === "FunctionDecl");
      const initDecl = decl.members.find((m) => m.kind === "InitDecl");
      const superviseDecls = decl.members.filter((m) => m.kind === "SuperviseDecl");
      this.writeLine(`${exportPrefix}class ${decl.name} {`);
      this.indentInc();
      if (stateMembers.length > 0 || initDecl) {
        const initParams = initDecl ? initDecl.params.map((p) => p.name).join(", ") : "";
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
        this.writeLine("}");
      }
      this.classStateFields = new Set(stateMembers.map((s) => s.name));
      for (const handler of onHandlers) {
        this.writeLine("");
        const params = handler.params.map((p) => p.name).join(", ");
        this.writeLine(`on${handler.messageName}(${params}) {`);
        this.emitBlockBody(handler.body);
        this.writeLine("}");
      }
      for (const fn of functions) {
        this.writeLine("");
        this.emitAnnotationsAsComments(fn.annotations);
        const asyncPrefix = fn.isAsync ? "async " : "";
        const params = fn.params.map((p) => p.name).join(", ");
        this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
        this.emitBlockBody(fn.body);
        this.writeLine("}");
      }
      for (const sup of superviseDecls) {
        this.writeLine("");
        this.writeLine(`/* supervise ${sup.childName} */`);
      }
      this.classStateFields = /* @__PURE__ */ new Set();
      this.indentDec();
      this.writeLine("}");
    }
    emitContractDecl(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      const stateMembers = decl.members.filter((m) => m.kind === "StateDecl");
      const functions = decl.members.filter((m) => m.kind === "FunctionDecl");
      const initDecl = decl.members.find((m) => m.kind === "InitDecl");
      if (decl.interfaces.length > 0) {
        this.writeLine(`/* implements ${decl.interfaces.join(", ")} */`);
      }
      this.writeLine(`${exportPrefix}class ${decl.name} {`);
      this.indentInc();
      if (stateMembers.length > 0 || initDecl) {
        const initParams = initDecl ? initDecl.params.map((p) => p.name).join(", ") : "";
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
        this.writeLine("}");
      }
      this.classStateFields = new Set(stateMembers.map((s) => s.name));
      for (const fn of functions) {
        this.writeLine("");
        this.emitAnnotationsAsComments(fn.annotations);
        const asyncPrefix = fn.isAsync ? "async " : "";
        const params = fn.params.map((p) => p.name).join(", ");
        this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
        this.emitBlockBody(fn.body);
        this.writeLine("}");
      }
      this.classStateFields = /* @__PURE__ */ new Set();
      this.indentDec();
      this.writeLine("}");
    }
    emitServerDecl(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      const stateMembers = decl.members.filter((m) => m.kind === "StateDecl");
      const fieldAssigns = decl.members.filter((m) => m.kind === "FieldAssignment");
      const functions = decl.members.filter((m) => m.kind === "FunctionDecl");
      this.writeLine(`${exportPrefix}class ${decl.name} {`);
      this.indentInc();
      if (stateMembers.length > 0 || fieldAssigns.length > 0) {
        this.writeLine("constructor() {");
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
        this.writeLine("}");
      }
      for (const fn of functions) {
        this.writeLine("");
        this.emitAnnotationsAsComments(fn.annotations);
        const asyncPrefix = fn.isAsync ? "async " : "";
        const params = fn.params.map((p) => p.name).join(", ");
        this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
        this.emitBlockBody(fn.body);
        this.writeLine("}");
      }
      this.indentDec();
      this.writeLine("}");
    }
    emitComponentDecl(decl) {
      this.emitAnnotationsAsComments(decl.annotations);
      const exportPrefix = decl.visibility === "public" ? "export " : "";
      const params = decl.params.map((p) => p.name).join(", ");
      this.writeLine(`${exportPrefix}function ${decl.name}(${params}) {`);
      this.emitBlockBody(decl.body);
      this.writeLine("}");
    }
    emitUseDecl(decl) {
      const path = decl.path.join("/");
      if (decl.isWildcard) {
        this.writeLine(`/* use ${path}::* */`);
        return;
      }
      for (const item of decl.items) {
        if (item.kind === "Named") {
          const alias = item.alias ? ` as ${item.alias}` : "";
          this.writeLine(`/* use ${path}::${item.name}${alias} */`);
        }
      }
    }
    emitModDecl(decl) {
      this.writeLine(`/* mod ${decl.name} */`);
    }
    emitStateDecl(decl) {
      if (decl.initializer) {
        this.writeLine(`let ${decl.name} = ${this.exprToString(decl.initializer)};`);
      } else {
        this.writeLine(`let ${decl.name};`);
      }
    }
    // ─── Statements ───────────────────────────────────────────────────
    emitStmt(stmt) {
      switch (stmt.kind) {
        case "LetStmt":
          this.emitLetStmt(stmt);
          break;
        case "ReturnStmt":
          this.emitReturnStmt(stmt);
          break;
        case "ExprStmt":
          this.writeLine(`${this.exprToString(stmt.expr)};`);
          break;
        case "IfStmt":
          this.emitIfStmt(stmt);
          break;
        case "WhileStmt":
          this.emitWhileStmt(stmt);
          break;
        case "ForStmt":
          this.emitForStmt(stmt);
          break;
        case "MatchStmt":
          this.emitMatchStmt(stmt);
          break;
        case "AssignStmt":
          this.writeLine(`${this.exprToString(stmt.target)} ${stmt.operator} ${this.exprToString(stmt.value)};`);
          break;
        case "ReplyStmt":
          this.writeLine(`return ${this.exprToString(stmt.value)};`);
          break;
        case "EmitStmt": {
          const args = stmt.args.map((a) => this.exprToString(a)).join(", ");
          this.writeLine(`/* emit ${stmt.eventName}(${args}) */`);
          break;
        }
        case "SpawnStmt": {
          const args = stmt.args.map((a) => this.exprToString(a)).join(", ");
          this.writeLine(`/* spawn ${stmt.actor}(${args}) */`);
          break;
        }
        case "DeployStmt": {
          const args = stmt.args.map((a) => this.exprToString(a.value)).join(", ");
          this.writeLine(`/* deploy ${stmt.contract}(${args}) */`);
          break;
        }
      }
    }
    emitLetStmt(stmt) {
      const keyword = stmt.mutable ? "let" : "const";
      this.writeLine(`${keyword} ${stmt.name} = ${this.exprToString(stmt.initializer)};`);
    }
    emitReturnStmt(stmt) {
      if (stmt.value) {
        this.writeLine(`return ${this.exprToString(stmt.value)};`);
      } else {
        this.writeLine("return;");
      }
    }
    emitIfStmt(stmt) {
      this.writeLine(`if (${this.exprToString(stmt.condition)}) {`);
      this.emitBlockBody(stmt.then);
      if (stmt.else_) {
        if (stmt.else_.kind === "IfStmt") {
          this.writeRaw(`${this.indentStr()}} else `);
          this.emitIfStmtInline(stmt.else_);
        } else {
          this.writeLine("} else {");
          this.emitBlockBody(stmt.else_);
          this.writeLine("}");
        }
      } else {
        this.writeLine("}");
      }
    }
    /** Emit an if statement that appears after `else ` on the same line */
    emitIfStmtInline(stmt) {
      this.output += `if (${this.exprToString(stmt.condition)}) {
`;
      this.emitBlockBody(stmt.then);
      if (stmt.else_) {
        if (stmt.else_.kind === "IfStmt") {
          this.writeRaw(`${this.indentStr()}} else `);
          this.emitIfStmtInline(stmt.else_);
        } else {
          this.writeLine("} else {");
          this.emitBlockBody(stmt.else_);
          this.writeLine("}");
        }
      } else {
        this.writeLine("}");
      }
    }
    emitWhileStmt(stmt) {
      this.writeLine(`while (${this.exprToString(stmt.condition)}) {`);
      this.emitBlockBody(stmt.body);
      this.writeLine("}");
    }
    emitForStmt(stmt) {
      this.writeLine(`for (const ${stmt.variable} of ${this.exprToString(stmt.iterable)}) {`);
      this.emitBlockBody(stmt.body);
      this.writeLine("}");
    }
    emitMatchStmt(stmt) {
      const subject = this.exprToString(stmt.subject);
      for (let i = 0; i < stmt.arms.length; i++) {
        const arm = stmt.arms[i];
        const condition = this.patternToCondition(subject, arm.pattern);
        const bindings = this.patternBindings(subject, arm.pattern);
        if (i === 0) {
          this.writeLine(`if (${condition}) {`);
        } else if (arm.pattern.kind === "WildcardPattern") {
          this.writeLine("} else {");
        } else {
          this.writeLine(`} else if (${condition}) {`);
        }
        this.indentInc();
        for (const b of bindings) {
          this.writeLine(b);
        }
        this.emitMatchArmBody(arm);
        this.indentDec();
      }
      this.writeLine("}");
    }
    emitMatchArmBody(arm) {
      if (arm.body.kind === "Block") {
        for (const s of arm.body.statements) {
          this.emitStmt(s);
        }
      } else {
        this.writeLine(`${this.exprToString(arm.body)};`);
      }
    }
    // ─── Expressions ──────────────────────────────────────────────────
    exprToString(expr) {
      switch (expr.kind) {
        case "IntLiteral":
          return expr.value;
        case "FloatLiteral":
          return expr.value;
        case "StringLiteral":
          return `"${expr.value}"`;
        case "StringInterpolation": {
          let result = "`";
          for (const part of expr.parts) {
            if (part.kind === "Literal") {
              result += part.value;
            } else {
              result += `\${${this.exprToString(part.expr)}}`;
            }
          }
          result += "`";
          return result;
        }
        case "BoolLiteral":
          return expr.value ? "true" : "false";
        case "Ident":
          if (this.classStateFields.has(expr.name)) return `this.${expr.name}`;
          return expr.name;
        case "Binary":
          return this.binaryToString(expr);
        case "Unary":
          return `${expr.operator}${this.exprToString(expr.operand)}`;
        case "Call":
          return this.callToString(expr);
        case "MethodCall": {
          const obj = this.exprToString(expr.object);
          const args = expr.args.map((a) => this.exprToString(a.value)).join(", ");
          return `${obj}.${expr.method}(${args})`;
        }
        case "FieldAccess":
          return `${this.exprToString(expr.object)}.${expr.field}`;
        case "Index":
          return `${this.exprToString(expr.object)}[${this.exprToString(expr.index)}]`;
        case "Struct":
          return this.structExprToString(expr);
        case "ArrayLiteral": {
          const elems = expr.elements.map((e) => this.exprToString(e)).join(", ");
          return `[${elems}]`;
        }
        case "Closure":
          return this.closureToString(expr);
        case "BlockExpr":
          return this.blockExprToString(expr);
        case "IfExpr":
          return this.ifExprToString(expr);
        case "MatchExpr":
          return this.matchExprToString(expr);
        case "Path":
          return expr.segments.join(".");
        case "Range": {
          const start = expr.start ? this.exprToString(expr.start) : "";
          const end = expr.end ? this.exprToString(expr.end) : "";
          const op = expr.inclusive ? "..=" : "..";
          return `/* ${start}${op}${end} */`;
        }
        case "Parallel":
          return "/* parallel { ... } */";
        case "Scope":
          return `/* scope ${expr.name} = ... { ... } */`;
        case "MacroCall": {
          const args = expr.args.map((a) => this.exprToString(a)).join(", ");
          if (expr.name === "print" || expr.name === "println") {
            return `console.log(${args})`;
          }
          if (expr.name === "verify") {
            return `/* verify!(${args}) */`;
          }
          if (expr.name === "math_sin") return `Math.sin(${args})`;
          if (expr.name === "math_cos") return `Math.cos(${args})`;
          if (expr.name === "math_sqrt") return `Math.sqrt(${args})`;
          if (expr.name === "math_floor") return `Math.floor(${args})`;
          if (expr.name === "math_abs") return `Math.abs(${args})`;
          if (expr.name === "math_tan") return `Math.tan(${args})`;
          if (expr.name === "math_atan2") return `Math.atan2(${args})`;
          if (expr.name === "math_min") return `Math.min(${args})`;
          if (expr.name === "math_max") return `Math.max(${args})`;
          if (expr.name === "math_round") return `Math.round(${args})`;
          if (expr.name === "canvas_size") return `(() => { __canvas.width = ${expr.args[0] ? this.exprToString(expr.args[0]) : "400"}; __canvas.height = ${expr.args[1] ? this.exprToString(expr.args[1]) : "400"}; })()`;
          if (expr.name === "canvas_clear") return `__ctx.clearRect(0, 0, __canvas.width, __canvas.height)`;
          if (expr.name === "canvas_fill_style") return `(() => { __ctx.fillStyle = ${args}; })()`;
          if (expr.name === "canvas_stroke_style") return `(() => { __ctx.strokeStyle = ${args}; })()`;
          if (expr.name === "canvas_line_width") return `(() => { __ctx.lineWidth = ${args}; })()`;
          if (expr.name === "canvas_fill_rect") return `__ctx.fillRect(${args})`;
          if (expr.name === "canvas_stroke_rect") return `__ctx.strokeRect(${args})`;
          if (expr.name === "canvas_line") {
            const a = expr.args.map((x) => this.exprToString(x));
            return `(() => { __ctx.beginPath(); __ctx.moveTo(${a[0]}, ${a[1]}); __ctx.lineTo(${a[2]}, ${a[3]}); __ctx.stroke(); })()`;
          }
          if (expr.name === "canvas_circle") {
            const a = expr.args.map((x) => this.exprToString(x));
            return `(() => { __ctx.beginPath(); __ctx.arc(${a[0]}, ${a[1]}, ${a[2]}, 0, 2 * Math.PI); __ctx.fill(); })()`;
          }
          if (expr.name === "canvas_text") return `__ctx.fillText(${args})`;
          if (expr.name === "canvas_font") return `(() => { __ctx.font = ${args}; })()`;
          if (expr.name === "canvas_begin_path") return `__ctx.beginPath()`;
          if (expr.name === "canvas_move_to") return `__ctx.moveTo(${args})`;
          if (expr.name === "canvas_line_to") return `__ctx.lineTo(${args})`;
          if (expr.name === "canvas_close_path") return `__ctx.closePath()`;
          if (expr.name === "canvas_fill") return `__ctx.fill()`;
          if (expr.name === "canvas_stroke") return `__ctx.stroke()`;
          if (expr.name === "canvas_save") return `__ctx.save()`;
          if (expr.name === "canvas_restore") return `__ctx.restore()`;
          if (expr.name === "canvas_translate") return `__ctx.translate(${args})`;
          if (expr.name === "canvas_rotate") return `__ctx.rotate(${args})`;
          if (expr.name === "canvas_scale") return `__ctx.scale(${args})`;
          if (expr.name === "canvas_animate") return `(function __animLoop() { ${args}(); requestAnimationFrame(__animLoop); })()`;
          if (expr.name === "math_random") return `Math.random()`;
          return `${expr.name}(${args})`;
        }
      }
    }
    binaryToString(expr) {
      const left = this.exprToString(expr.left);
      const right = this.exprToString(expr.right);
      const leftStr = this.needsParens(expr.left, expr, "left") ? `(${left})` : left;
      const rightStr = this.needsParens(expr.right, expr, "right") ? `(${right})` : right;
      return `${leftStr} ${expr.operator} ${rightStr}`;
    }
    needsParens(child, parent, _side) {
      if (child.kind !== "Binary") return false;
      const childPrec = this.opPrecedence(child.operator);
      const parentPrec = this.opPrecedence(parent.operator);
      if (childPrec < parentPrec) return true;
      if (childPrec === parentPrec && _side === "right") return true;
      return false;
    }
    opPrecedence(op) {
      switch (op) {
        case "||":
          return 1;
        case "&&":
          return 2;
        case "==":
        case "!=":
          return 3;
        case "<":
        case ">":
        case "<=":
        case ">=":
          return 4;
        case "+":
        case "-":
          return 6;
        case "*":
        case "/":
        case "%":
          return 7;
        default:
          return 0;
      }
    }
    callToString(expr) {
      const callee = this.exprToString(expr.callee);
      const args = expr.args.map((a) => this.exprToString(a.value)).join(", ");
      const prefix = this.classNames.has(callee) ? "new " : "";
      return `${prefix}${callee}(${args})`;
    }
    structExprToString(expr) {
      if (expr.fields.length === 0) {
        return "{}";
      }
      const fields = expr.fields.map((f) => `${f.name}: ${this.exprToString(f.value)}`).join(", ");
      return `{ ${fields} }`;
    }
    closureToString(expr) {
      const params = expr.params.map((p) => p.name).join(", ");
      if (expr.body.kind === "Block") {
        const body = this.blockToInlineString(expr.body);
        return `(${params}) => ${body}`;
      }
      return `(${params}) => ${this.exprToString(expr.body)}`;
    }
    blockToInlineString(block) {
      if (block.statements.length === 1) {
        const stmt = block.statements[0];
        if (stmt.kind === "ReturnStmt" && stmt.value) {
          return this.exprToString(stmt.value);
        }
        if (stmt.kind === "ExprStmt") {
          return this.exprToString(stmt.expr);
        }
      }
      const saved = this.output;
      const savedIndent = this.indent;
      this.output = "";
      this.output += "{\n";
      this.indentInc();
      for (const s of block.statements) {
        this.emitStmt(s);
      }
      this.indentDec();
      this.output += `${this.indentStr()}}`;
      const result = this.output;
      this.output = saved;
      this.indent = savedIndent;
      return result;
    }
    blockExprToString(expr) {
      const saved = this.output;
      const savedIndent = this.indent;
      this.output = "";
      this.output += "(() => {\n";
      this.indentInc();
      for (const s of expr.block.statements) {
        this.emitStmt(s);
      }
      this.indentDec();
      this.output += `${this.indentStr()}})()`;
      const result = this.output;
      this.output = saved;
      this.indent = savedIndent;
      return result;
    }
    ifExprToString(expr) {
      const cond = this.exprToString(expr.condition);
      const thenVal = this.blockAsValue(expr.then);
      if (expr.else_) {
        if (expr.else_.kind === "IfExpr") {
          const elseVal2 = this.ifExprToString(expr.else_);
          return `${cond} ? ${thenVal} : ${elseVal2}`;
        }
        const elseVal = this.blockAsValue(expr.else_);
        return `${cond} ? ${thenVal} : ${elseVal}`;
      }
      return `${cond} ? ${thenVal} : undefined`;
    }
    blockAsValue(block) {
      if (block.statements.length === 1) {
        const stmt = block.statements[0];
        if (stmt.kind === "ExprStmt") return this.exprToString(stmt.expr);
        if (stmt.kind === "ReturnStmt" && stmt.value) return this.exprToString(stmt.value);
      }
      return this.blockExprToStringHelper(block);
    }
    blockExprToStringHelper(block) {
      const saved = this.output;
      const savedIndent = this.indent;
      this.output = "";
      this.output += "(() => {\n";
      this.indentInc();
      for (const s of block.statements) {
        this.emitStmt(s);
      }
      this.indentDec();
      this.output += `${this.indentStr()}})()`;
      const result = this.output;
      this.output = saved;
      this.indent = savedIndent;
      return result;
    }
    matchExprToString(expr) {
      const subject = this.exprToString(expr.subject);
      const saved = this.output;
      const savedIndent = this.indent;
      this.output = "";
      this.output += `(() => {
`;
      this.indentInc();
      this.writeLine(`const __match = ${subject};`);
      for (let i = 0; i < expr.arms.length; i++) {
        const arm = expr.arms[i];
        const condition = this.patternToCondition("__match", arm.pattern);
        const bindings = this.patternBindings("__match", arm.pattern);
        if (i === 0) {
          this.writeLine(`if (${condition}) {`);
        } else if (arm.pattern.kind === "WildcardPattern") {
          this.writeLine("} else {");
        } else {
          this.writeLine(`} else if (${condition}) {`);
        }
        this.indentInc();
        for (const b of bindings) {
          this.writeLine(b);
        }
        if (arm.body.kind === "Block") {
          for (const s of arm.body.statements) {
            this.emitStmt(s);
          }
        } else {
          this.writeLine(`return ${this.exprToString(arm.body)};`);
        }
        this.indentDec();
      }
      this.writeLine("}");
      this.indentDec();
      this.output += `${this.indentStr()}})()`;
      const result = this.output;
      this.output = saved;
      this.indent = savedIndent;
      return result;
    }
    // ─── Pattern helpers ──────────────────────────────────────────────
    patternToCondition(subject, pattern) {
      switch (pattern.kind) {
        case "LiteralPattern":
          if (typeof pattern.value === "string") {
            return `${subject} === "${pattern.value}"`;
          }
          return `${subject} === ${pattern.value}`;
        case "IdentPattern":
          return "true";
        case "ConstructorPattern":
          if (pattern.fields.length === 0) {
            return `${subject} === "${pattern.name}"`;
          }
          return `${subject}.tag === "${pattern.name}"`;
        case "WildcardPattern":
          return "true";
      }
    }
    patternBindings(subject, pattern) {
      switch (pattern.kind) {
        case "IdentPattern":
          return [`const ${pattern.name} = ${subject};`];
        case "ConstructorPattern":
          return pattern.fields.flatMap((f, i) => {
            if (f.kind === "IdentPattern") {
              return [`const ${f.name} = ${subject}.values[${i}];`];
            }
            return [];
          });
        default:
          return [];
      }
    }
    // ─── Annotation helpers ───────────────────────────────────────────
    emitAnnotationsAsComments(annotations) {
      for (const a of annotations) {
        if (a.name === "intent") {
          this.writeLine(`/* @intent(${a.args}) */`);
        } else {
          this.writeLine(`/* ${a.raw} */`);
        }
      }
    }
    // ─── Block body helper ────────────────────────────────────────────
    emitBlockBody(block) {
      this.indentInc();
      for (const stmt of block.statements) {
        this.emitStmt(stmt);
      }
      this.indentDec();
    }
    // ─── Output helpers ───────────────────────────────────────────────
    writeLine(text) {
      this.output += `${this.indentStr()}${text}
`;
    }
    writeRaw(text) {
      this.output += text;
    }
    indentStr() {
      return "  ".repeat(this.indent);
    }
    indentInc() {
      this.indent++;
    }
    indentDec() {
      this.indent--;
    }
  };

  // src/index.ts
  var VERSION = "0.1.0";
  return __toCommonJS(index_exports);
})();
