// C! Playground — browser-based compiler and runner
//
// Security note: This playground intentionally executes user-authored C! code
// compiled to JavaScript.  The execution happens entirely client-side in the
// user's own browser — no server is involved and no untrusted third-party
// code is evaluated.  The use of the Function constructor below is the
// standard approach for browser-based language playgrounds (e.g., the Rust,
// Go, and TypeScript playgrounds all do the same).

const EXAMPLES = {
  hello: `// Hello World — your first C! program
// Demonstrates: effect system (with IO), string interpolation

fn main() with IO {
    let lang = "C!";
    println!("Hello from {lang}");
    println!("A language built for AI-human collaboration.");
}`,

  fibonacci: `// Fibonacci — pure functions and effect tracking
// Demonstrates: pure keyword, intent annotations, string interpolation

#[intent("compute the nth Fibonacci number recursively")]
pure fn fib(n: i32) -> i32 {
    if n <= 1 {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

fn main() with IO {
    let result = fib(10);
    println!("fib(10) = {result}");
}`,

  actor: `// Counter Actor — message-driven concurrency
// Demonstrates: actor model, state, intent annotations, emit/reply

actor Counter {
    state count: i32 = 0

    #[intent("increment the counter by one")]
    on Increment() {
        count += 1;
        emit CountChanged(count);
    }

    #[intent("reset the counter to zero")]
    on Reset() {
        count = 0;
        emit CountChanged(count);
    }

    #[intent("return the current count")]
    on GetCount() {
        reply count;
    }
}

fn main() with IO {
    println!("Counter actor: Increment, Reset, GetCount");
    println!("Intent annotations describe each handler's purpose.");
}`,

  pattern: `// Pattern Matching — enums and exhaustive matching
// Demonstrates: enum variants, pattern matching, pure functions, intents

enum Shape {
    Circle(f64),
    Rect(f64, f64),
}

#[intent("compute the area of any shape")]
pure fn area(s: Shape) -> f64 {
    match s {
        Circle(r) => { return 3.14159 * r * r; },
        Rect(w, h) => { return w * h; },
    }
}

#[intent("describe a shape in human-readable form")]
pure fn describe(s: Shape) -> String {
    match s {
        Circle(r) => { return "circle"; },
        Rect(w, h) => { return "rectangle"; },
    }
}`,

  chat: `// Chat Application — actors for real-time messaging
// Demonstrates: actor supervision, intent annotations, effects, emit/reply

type Message {
    sender: String,
    text: String,
}

actor ChatRoom {
    state members: i32 = 0
    state message_count: i32 = 0

    #[intent("register a new user in the chat room")]
    on Join(name: String) {
        members += 1;
        emit UserJoined(name, members);
    }

    #[intent("remove a user from the chat room")]
    on Leave(name: String) {
        members -= 1;
        emit UserLeft(name, members);
    }

    #[intent("broadcast a message to all room members")]
    on SendMessage(sender: String, text: String) {
        message_count += 1;
        emit NewMessage(sender, text, message_count);
    }

    #[intent("return current room statistics")]
    on GetStats() {
        reply members;
    }
}

actor Moderator {
    state warnings: i32 = 0

    #[intent("filter inappropriate content before delivery")]
    on Review(sender: String, text: String) {
        let is_ok = true;
        if is_ok {
            emit Approved(sender, text);
        } else {
            warnings += 1;
            emit Rejected(sender, warnings);
        }
    }
}

fn main() with IO {
    println!("Chat system compiled successfully!");
    println!("Every handler has an intent — AI agents can");
    println!("reason about what each message does.");
}`,

  contract: `// Token Contract — ERC20-style token with minting and transfers
// Demonstrates: contracts, intent annotations, pure functions, emit/reply

contract Token {
    state name: String
    state symbol: String
    state total_supply: u256 = 0
    state owner: Address

    init() {
        owner = caller;
        name = "CBangCoin";
        symbol = "CBC";
    }

    #[intent("create new tokens, only callable by owner")]
    pub fn mint(to: Address, amount: u256) {
        total_supply += amount;
        emit Transfer(to, amount);
    }

    #[intent("transfer tokens between accounts safely")]
    pub fn transfer(to: Address, amount: u256) {
        emit Transfer(to, amount);
    }

    #[intent("return the current total token supply")]
    pub fn get_supply() {
        reply total_supply;
    }
}

contract NFTMarketplace {
    state listing_count: u256 = 0
    state fee_percent: u256 = 2

    #[intent("list an NFT for sale at a given price")]
    pub fn list_item(token_id: u256, price: u256) {
        listing_count += 1;
        emit ItemListed(token_id, price, listing_count);
    }

    #[intent("purchase a listed NFT, transferring ownership")]
    pub fn buy_item(listing_id: u256) {
        emit ItemSold(listing_id, caller);
    }

    #[intent("compute marketplace fee for a given price")]
    pub pure fn calculate_fee(price: u256) -> u256 {
        return price * 2 / 100;
    }
}

fn main() with IO {
    println!("Token contract: CBangCoin (CBC)");
    println!("NFT Marketplace with 2% fee");
    println!("Contracts compiled to JavaScript classes!");
}`,

  spinning: `// 3D Spinning Cube — real graphics with canvas
// Demonstrates: canvas API, math builtins, pure functions, 3D projection

#[intent("project a 3D point onto the 2D canvas with perspective")]
fn project(x: f64, y: f64, z: f64, angle_y: f64, angle_x: f64) {
    // Rotate around Y axis
    let cos_y = math_cos!(angle_y);
    let sin_y = math_sin!(angle_y);
    let rx = x * cos_y + z * sin_y;
    let rz = z * cos_y - x * sin_y;

    // Rotate around X axis
    let cos_x = math_cos!(angle_x);
    let sin_x = math_sin!(angle_x);
    let ry = y * cos_x - rz * sin_x;
    let rz2 = rz * cos_x + y * sin_x;

    // Perspective projection
    let dist = 5.0;
    let scale = dist / (dist + rz2);
    let sx = 200.0 + rx * scale * 120.0;
    let sy = 200.0 + ry * scale * 120.0;

    // Draw a vertex dot
    canvas_fill_style!("#ffffff");
    canvas_circle!(sx, sy, 3.0 * scale);

    // Store projected coords in global arrays
    println!("{sx},{sy}");
}

#[intent("draw a colored line between two 3D points")]
fn draw_edge(x1: f64, y1: f64, z1: f64, x2: f64, y2: f64, z2: f64, angle_y: f64, angle_x: f64, color: String) {
    let cos_y = math_cos!(angle_y);
    let sin_y = math_sin!(angle_y);
    let cos_x = math_cos!(angle_x);
    let sin_x = math_sin!(angle_x);
    let dist = 5.0;

    // Project point 1
    let rx1 = x1 * cos_y + z1 * sin_y;
    let rz1 = z1 * cos_y - x1 * sin_y;
    let ry1 = y1 * cos_x - rz1 * sin_x;
    let rz1b = rz1 * cos_x + y1 * sin_x;
    let s1 = dist / (dist + rz1b);
    let sx1 = 200.0 + rx1 * s1 * 120.0;
    let sy1 = 200.0 + ry1 * s1 * 120.0;

    // Project point 2
    let rx2 = x2 * cos_y + z2 * sin_y;
    let rz2 = z2 * cos_y - x2 * sin_y;
    let ry2 = y2 * cos_x - rz2 * sin_x;
    let rz2b = rz2 * cos_x + y2 * sin_x;
    let s2 = dist / (dist + rz2b);
    let sx2 = 200.0 + rx2 * s2 * 120.0;
    let sy2 = 200.0 + ry2 * s2 * 120.0;

    // Draw edge
    canvas_stroke_style!(color);
    canvas_line_width!(2.0);
    canvas_line!(sx1, sy1, sx2, sy2);
}

#[intent("render a wireframe cube with colored faces")]
fn draw_cube(angle_y: f64, angle_x: f64) {
    // 8 vertices of a unit cube centered at origin
    // Front face edges (z = -1)
    draw_edge(0.0-1.0, 0.0-1.0, 0.0-1.0,  1.0, 0.0-1.0, 0.0-1.0, angle_y, angle_x, "#00ffff");
    draw_edge( 1.0, 0.0-1.0, 0.0-1.0,  1.0,  1.0, 0.0-1.0, angle_y, angle_x, "#00ffff");
    draw_edge( 1.0,  1.0, 0.0-1.0, 0.0-1.0,  1.0, 0.0-1.0, angle_y, angle_x, "#00ffff");
    draw_edge(0.0-1.0,  1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0, angle_y, angle_x, "#00ffff");

    // Back face edges (z = 1)
    draw_edge(0.0-1.0, 0.0-1.0, 1.0,  1.0, 0.0-1.0, 1.0, angle_y, angle_x, "#ff00ff");
    draw_edge( 1.0, 0.0-1.0, 1.0,  1.0,  1.0, 1.0, angle_y, angle_x, "#ff00ff");
    draw_edge( 1.0,  1.0, 1.0, 0.0-1.0,  1.0, 1.0, angle_y, angle_x, "#ff00ff");
    draw_edge(0.0-1.0,  1.0, 1.0, 0.0-1.0, 0.0-1.0, 1.0, angle_y, angle_x, "#ff00ff");

    // Connecting edges
    draw_edge(0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0, 1.0, angle_y, angle_x, "#ffff00");
    draw_edge( 1.0, 0.0-1.0, 0.0-1.0,  1.0, 0.0-1.0, 1.0, angle_y, angle_x, "#ffff00");
    draw_edge( 1.0,  1.0, 0.0-1.0,  1.0,  1.0, 1.0, angle_y, angle_x, "#ffff00");
    draw_edge(0.0-1.0,  1.0, 0.0-1.0, 0.0-1.0,  1.0, 1.0, angle_y, angle_x, "#ffff00");
}

fn main() with IO {
    canvas_size!(400, 400);

    // Dark background
    canvas_fill_style!("#0a0a2e");
    canvas_fill_rect!(0.0, 0.0, 400.0, 400.0);

    // Title
    canvas_font!("16px monospace");
    canvas_fill_style!("#00ff88");
    canvas_text!("C! 3D Cube", 150.0, 30.0);

    // Draw cube rotated
    draw_cube(0.8, 0.5);

    // Label
    canvas_font!("12px monospace");
    canvas_fill_style!("#666688");
    canvas_text!("Rendered with C! canvas API", 110.0, 390.0);

    println!("3D cube rendered on canvas!");
}`,
};

function getEditorValue() {
  return document.getElementById('editor').value;
}

function setEditorValue(code) {
  document.getElementById('editor').value = code;
}

function compile(source) {
  try {
    var lexer = new CBang.Lexer(source, 'playground.cb');
    var tokens = lexer.tokenize();

    var lexErrors = tokens.filter(function (t) {
      return t.type === 'Error';
    });
    if (lexErrors.length > 0) {
      return { error: lexErrors.map(function (e) { return 'Lex error: ' + e.value; }).join('\n') };
    }

    var parser = new CBang.Parser(tokens);
    var result = parser.parse();

    if (result.diagnostics.length > 0) {
      return {
        error: result.diagnostics.map(function (d) {
          return CBang.formatDiagnostic(d, source, { noColor: true });
        }).join('\n\n'),
      };
    }

    var gen = new CBang.JsGenerator();
    var js = gen.generate(result.program);
    return { js: js };
  } catch (e) {
    return { error: e.message };
  }
}

function run() {
  var source = getEditorValue();
  var result = compile(source);

  var jsOutput = document.getElementById('js-output');
  var consoleOutput = document.getElementById('console-output');

  if (result.error) {
    jsOutput.textContent = '';
    consoleOutput.textContent = result.error;
    consoleOutput.className = 'pg-output error';
    return;
  }

  jsOutput.textContent = result.js;
  consoleOutput.className = 'pg-output';
  consoleOutput.textContent = 'Running...';

  var execCode = result.js;
  // Auto-call main() if defined
  if (execCode.indexOf('function main(') !== -1) {
    execCode += '\nmain();';
  }

  // Detect if code uses canvas functions
  var usesCanvas = execCode.indexOf('__canvas') !== -1 || execCode.indexOf('__ctx') !== -1;

  // Execute in a sandboxed iframe via Blob URL to avoid needing unsafe-eval.
  // The iframe posts console output back to us via postMessage.
  var iframeHtml = '<!DOCTYPE html><html><head><script>' +
    'var __canvas = document.createElement("canvas"); __canvas.id = "c"; __canvas.width = 400; __canvas.height = 400; document.body.appendChild(__canvas);' +
    'var __ctx = __canvas.getContext("2d");' +
    'var __logs = [];' +
    'console.log = function() { __logs.push(Array.prototype.slice.call(arguments).join(" ")); };' +
    'console.warn = function() { __logs.push("[warn] " + Array.prototype.slice.call(arguments).join(" ")); };' +
    'console.error = function() { __logs.push("[error] " + Array.prototype.slice.call(arguments).join(" ")); };' +
    'try {' + execCode.replace(/<\/script>/gi, '<\\/script>') + ';' +
    '  var __canvasData = null; try { __canvasData = __canvas.toDataURL("image/png"); } catch(ce) {}' +
    '  parent.postMessage({ type: "cbang-output", logs: __logs, canvasData: __canvasData }, "*");' +
    '} catch(e) {' +
    '  var __canvasData2 = null; try { __canvasData2 = __canvas.toDataURL("image/png"); } catch(ce) {}' +
    '  parent.postMessage({ type: "cbang-output", logs: __logs, error: e.message, canvasData: __canvasData2 }, "*");' +
    '}' +
    '<\/script></head><body style="margin:0;padding:0;background:#0a0a2e;"></body></html>';

  var blob = new Blob([iframeHtml], { type: 'text/html' });
  var url = URL.createObjectURL(blob);

  // Remove any previous sandbox iframe
  var oldFrame = document.getElementById('cbang-sandbox');
  if (oldFrame) oldFrame.remove();

  var iframe = document.createElement('iframe');
  iframe.id = 'cbang-sandbox';
  iframe.style.display = 'none';
  iframe.sandbox = 'allow-scripts';
  iframe.src = url;
  document.body.appendChild(iframe);

  // Listen for result
  var timeout = setTimeout(function () {
    window.removeEventListener('message', onMessage);
    consoleOutput.textContent = '(timeout — program took too long)';
    consoleOutput.className = 'pg-output error';
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 5000);

  function onMessage(e) {
    // Only accept messages from our sandboxed iframe (origin is 'null' for
    // sandbox iframes loaded via blob: URLs).
    if (e.source !== iframe.contentWindow) return;
    if (!e.data || e.data.type !== 'cbang-output') return;

    clearTimeout(timeout);
    window.removeEventListener('message', onMessage);
    var logText = (Array.isArray(e.data.logs) ? e.data.logs : []).join('\n');
    if (e.data.error) {
      consoleOutput.textContent = (logText ? logText + '\n' : '') + 'Runtime error: ' + String(e.data.error);
      consoleOutput.className = 'pg-output error';
    } else {
      consoleOutput.textContent = logText || '(no output)';
      consoleOutput.className = 'pg-output success';
    }

    // Show canvas output if available — only accept data: URIs
    var canvasPanel = document.getElementById('canvas-panel');
    var canvasImg = document.getElementById('canvas-img');
    var canvasData = e.data.canvasData;
    if (usesCanvas && typeof canvasData === 'string' && canvasData.indexOf('data:image/') === 0) {
      canvasImg.src = canvasData;
      canvasPanel.style.display = 'flex';
    } else {
      canvasPanel.style.display = 'none';
    }

    iframe.remove();
    URL.revokeObjectURL(url);
  }
  window.addEventListener('message', onMessage);
}

function loadExample(name) {
  if (EXAMPLES[name]) {
    setEditorValue(EXAMPLES[name]);
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', function () {
  // Set default code
  setEditorValue(EXAMPLES.hello);

  // Run button
  document.getElementById('run-btn').addEventListener('click', run);

  // Examples dropdown
  document.getElementById('examples-select').addEventListener('change', function () {
    if (this.value) {
      loadExample(this.value);
      this.value = '';
    }
  });

  // Ctrl/Cmd+Enter to run
  document.getElementById('editor').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
    // Tab inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = this.selectionStart;
      var end = this.selectionEnd;
      this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 4;
    }
  });
});
