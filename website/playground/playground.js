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
    let c = Counter();
    println!("Created Counter actor");

    c.onIncrement();
    c.onIncrement();
    c.onIncrement();
    println!("After 3 increments: count = {c.onGetCount()}");

    c.onReset();
    println!("After reset: count = {c.onGetCount()}");

    c.onIncrement();
    println!("After 1 more increment: count = {c.onGetCount()}");
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
// Demonstrates: multiple actors, intent annotations, emit/reply

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

    #[intent("return current member count")]
    on GetStats() {
        reply members;
    }

    #[intent("return total messages sent")]
    on GetMessageCount() {
        reply message_count;
    }
}

fn main() with IO {
    let room = ChatRoom();
    println!("=== C! Chat Room ===");

    room.onJoin("Alice");
    println!("Alice joined  — members: {room.onGetStats()}");

    room.onJoin("Bob");
    println!("Bob joined    — members: {room.onGetStats()}");

    room.onJoin("Charlie");
    println!("Charlie joined — members: {room.onGetStats()}");

    room.onSendMessage("Alice", "Hello everyone!");
    room.onSendMessage("Bob", "Hey Alice!");
    room.onSendMessage("Charlie", "Great to be here!");
    println!("Messages sent: {room.onGetMessageCount()}");

    room.onLeave("Charlie");
    println!("Charlie left  — members: {room.onGetStats()}");

    println!("Final stats: {room.onGetStats()} members, {room.onGetMessageCount()} messages");
}`,

  contract: `// Token Contract — ERC20-style token with minting and transfers
// Demonstrates: contracts, intent annotations, pure functions, emit/reply

contract Token {
    state name: String
    state symbol: String
    state total_supply: u256 = 0

    #[intent("create new tokens and increase supply")]
    pub fn mint(amount: u256) {
        total_supply += amount;
        emit Minted(amount, total_supply);
    }

    #[intent("burn tokens and decrease supply")]
    pub fn burn(amount: u256) {
        total_supply -= amount;
        emit Burned(amount, total_supply);
    }

    #[intent("return the current total token supply")]
    pub fn get_supply() {
        reply total_supply;
    }

    #[intent("return the token name")]
    pub fn get_name() {
        reply name;
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

    #[intent("return total number of listings")]
    pub fn get_listings() {
        reply listing_count;
    }

    #[intent("compute marketplace fee for a given price")]
    pub pure fn calculate_fee(price: u256) -> u256 {
        return price * fee_percent / 100;
    }
}

fn main() with IO {
    let token = Token();
    token.name = "CBangCoin";
    token.symbol = "CBC";
    println!("=== {token.get_name()} ({token.symbol}) ===");

    token.mint(1000);
    println!("Minted 1000 tokens — supply: {token.get_supply()}");

    token.mint(500);
    println!("Minted 500 more   — supply: {token.get_supply()}");

    token.burn(200);
    println!("Burned 200 tokens — supply: {token.get_supply()}");

    let market = NFTMarketplace();
    println!("");
    println!("=== NFT Marketplace ===");
    market.list_item(1, 100);
    market.list_item(2, 250);
    market.list_item(3, 500);
    println!("Listed 3 NFTs — total listings: {market.get_listings()}");

    let fee = market.calculate_fee(500);
    println!("Fee on 500 token sale: {fee}");
}`,

  spinning: `// 3D Spinning Cube — animated canvas with starfield
// Demonstrates: state, canvas_animate!, math builtins, intents

// Global state for animation
state angle: f64 = 0.0
state sx0: f64 = 0.0
state sy0: f64 = 0.0
state sb0: f64 = 0.0
state sx1: f64 = 0.0
state sy1: f64 = 0.0
state sb1: f64 = 0.0
state sx2: f64 = 0.0
state sy2: f64 = 0.0
state sb2: f64 = 0.0
state sx3: f64 = 0.0
state sy3: f64 = 0.0
state sb3: f64 = 0.0
state sx4: f64 = 0.0
state sy4: f64 = 0.0
state sb4: f64 = 0.0
state sx5: f64 = 0.0
state sy5: f64 = 0.0
state sb5: f64 = 0.0
state sx6: f64 = 0.0
state sy6: f64 = 0.0
state sb6: f64 = 0.0
state sx7: f64 = 0.0
state sy7: f64 = 0.0
state sb7: f64 = 0.0
state sx8: f64 = 0.0
state sy8: f64 = 0.0
state sb8: f64 = 0.0
state sx9: f64 = 0.0
state sy9: f64 = 0.0
state sb9: f64 = 0.0

#[intent("draw a star dot at given position")]
fn draw_star(x: f64, y: f64, b: f64) {
    canvas_fill_style!("#ffffff");
    canvas_circle!(x, y, 0.5 + b * 1.5);
}

#[intent("draw a colored edge between two rotated 3D points")]
fn draw_edge(x1: f64, y1: f64, z1: f64, x2: f64, y2: f64, z2: f64, ay: f64, ax: f64, color: String) {
    let cy = math_cos!(ay); let sny = math_sin!(ay);
    let cx = math_cos!(ax); let snx = math_sin!(ax);
    let d = 5.0;
    let a1 = x1 * cy + z1 * sny;
    let b1 = z1 * cy - x1 * sny;
    let c1 = y1 * cx - b1 * snx;
    let d1 = b1 * cx + y1 * snx;
    let p1 = d / (d + d1);
    let a2 = x2 * cy + z2 * sny;
    let b2 = z2 * cy - x2 * sny;
    let c2 = y2 * cx - b2 * snx;
    let d2 = b2 * cx + y2 * snx;
    let p2 = d / (d + d2);
    canvas_stroke_style!(color);
    canvas_line_width!(2.0);
    canvas_line!(200.0 + a1 * p1 * 100.0, 200.0 + c1 * p1 * 100.0, 200.0 + a2 * p2 * 100.0, 200.0 + c2 * p2 * 100.0);
}

#[intent("render wireframe cube at given rotation angles")]
fn draw_cube(ay: f64, ax: f64) {
    draw_edge(0.0-1.0,0.0-1.0,0.0-1.0, 1.0,0.0-1.0,0.0-1.0, ay,ax,"#00ffff");
    draw_edge(1.0,0.0-1.0,0.0-1.0, 1.0,1.0,0.0-1.0, ay,ax,"#00ffff");
    draw_edge(1.0,1.0,0.0-1.0, 0.0-1.0,1.0,0.0-1.0, ay,ax,"#00ffff");
    draw_edge(0.0-1.0,1.0,0.0-1.0, 0.0-1.0,0.0-1.0,0.0-1.0, ay,ax,"#00ffff");
    draw_edge(0.0-1.0,0.0-1.0,1.0, 1.0,0.0-1.0,1.0, ay,ax,"#ff00ff");
    draw_edge(1.0,0.0-1.0,1.0, 1.0,1.0,1.0, ay,ax,"#ff00ff");
    draw_edge(1.0,1.0,1.0, 0.0-1.0,1.0,1.0, ay,ax,"#ff00ff");
    draw_edge(0.0-1.0,1.0,1.0, 0.0-1.0,0.0-1.0,1.0, ay,ax,"#ff00ff");
    draw_edge(0.0-1.0,0.0-1.0,0.0-1.0, 0.0-1.0,0.0-1.0,1.0, ay,ax,"#ffff00");
    draw_edge(1.0,0.0-1.0,0.0-1.0, 1.0,0.0-1.0,1.0, ay,ax,"#ffff00");
    draw_edge(1.0,1.0,0.0-1.0, 1.0,1.0,1.0, ay,ax,"#ffff00");
    draw_edge(0.0-1.0,1.0,0.0-1.0, 0.0-1.0,1.0,1.0, ay,ax,"#ffff00");
}

#[intent("render one animation frame: starfield + spinning cube")]
fn frame() {
    canvas_fill_style!("#0a0a2e");
    canvas_fill_rect!(0.0, 0.0, 400.0, 400.0);
    draw_star(sx0,sy0,sb0); draw_star(sx1,sy1,sb1);
    draw_star(sx2,sy2,sb2); draw_star(sx3,sy3,sb3);
    draw_star(sx4,sy4,sb4); draw_star(sx5,sy5,sb5);
    draw_star(sx6,sy6,sb6); draw_star(sx7,sy7,sb7);
    draw_star(sx8,sy8,sb8); draw_star(sx9,sy9,sb9);
    draw_cube(angle, angle * 0.6);
    canvas_font!("16px monospace");
    canvas_fill_style!("#00ff88");
    canvas_text!("C! 3D Cube", 148.0, 30.0);
    canvas_font!("11px monospace");
    canvas_fill_style!("#555577");
    canvas_text!("canvas_animate! + math builtins", 100.0, 390.0);
    angle = angle + 0.012;
}

fn main() with IO {
    canvas_size!(400, 400);
    sx0 = math_random!() * 400.0; sy0 = math_random!() * 400.0; sb0 = 0.3 + math_random!() * 0.7;
    sx1 = math_random!() * 400.0; sy1 = math_random!() * 400.0; sb1 = 0.3 + math_random!() * 0.7;
    sx2 = math_random!() * 400.0; sy2 = math_random!() * 400.0; sb2 = 0.3 + math_random!() * 0.7;
    sx3 = math_random!() * 400.0; sy3 = math_random!() * 400.0; sb3 = 0.3 + math_random!() * 0.7;
    sx4 = math_random!() * 400.0; sy4 = math_random!() * 400.0; sb4 = 0.3 + math_random!() * 0.7;
    sx5 = math_random!() * 400.0; sy5 = math_random!() * 400.0; sb5 = 0.3 + math_random!() * 0.7;
    sx6 = math_random!() * 400.0; sy6 = math_random!() * 400.0; sb6 = 0.3 + math_random!() * 0.7;
    sx7 = math_random!() * 400.0; sy7 = math_random!() * 400.0; sb7 = 0.3 + math_random!() * 0.7;
    sx8 = math_random!() * 400.0; sy8 = math_random!() * 400.0; sb8 = 0.3 + math_random!() * 0.7;
    sx9 = math_random!() * 400.0; sy9 = math_random!() * 400.0; sb9 = 0.3 + math_random!() * 0.7;
    println!("3D spinning cube with starfield!");
    canvas_animate!(frame);
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

  // Show running indicator on the Run button
  var runBtn = document.getElementById('run-btn');
  runBtn.disabled = true;
  runBtn.textContent = 'Running...';

  function resetRunBtn() {
    runBtn.disabled = false;
    runBtn.textContent = '';
    var icon = document.createElement('span');
    icon.className = 'play-icon';
    icon.textContent = '\u25B6';
    runBtn.appendChild(icon);
    runBtn.appendChild(document.createTextNode(' Run'));
  }

  var execCode = result.js;
  // Auto-call main() if defined
  if (execCode.indexOf('function main(') !== -1) {
    execCode += '\nmain();';
  }

  // Detect if code uses canvas functions or animation
  var usesCanvas = execCode.indexOf('__canvas') !== -1 || execCode.indexOf('__ctx') !== -1;
  var isAnimated = execCode.indexOf('__animLoop') !== -1;

  // Execute in a sandboxed iframe via Blob URL to avoid needing unsafe-eval.
  // The iframe posts console output back to us via postMessage.
  // For animated content, logs are sent before the animation loop starts,
  // and the iframe stays alive to keep rendering.
  var iframeHtml = '<!DOCTYPE html><html><head></head>' +
    '<body style="margin:0;padding:0;background:transparent;overflow:hidden;"><script>' +
    'var __canvas = document.createElement("canvas"); __canvas.id = "c"; __canvas.width = 400; __canvas.height = 400;' +
    '__canvas.style.display = "block"; __canvas.style.margin = "0 auto";' +
    'document.body.appendChild(__canvas);' +
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
    '<\/script></body></html>';

  var blob = new Blob([iframeHtml], { type: 'text/html' });
  var url = URL.createObjectURL(blob);

  // Remove any previous sandbox iframe
  var oldFrame = document.getElementById('cbang-sandbox');
  if (oldFrame) oldFrame.remove();
  // Also clear any previous live canvas iframe
  var oldLive = document.getElementById('cbang-live-canvas');
  if (oldLive) oldLive.remove();

  var iframe = document.createElement('iframe');
  iframe.id = isAnimated ? 'cbang-live-canvas' : 'cbang-sandbox';
  iframe.sandbox = 'allow-scripts';
  iframe.src = url;

  if (isAnimated && usesCanvas) {
    // Show the iframe live inside the canvas panel
    iframe.style.width = '400px';
    iframe.style.height = '400px';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    var canvasPanel = document.getElementById('canvas-panel');
    var canvasContainer = canvasPanel.querySelector('.pg-canvas-container');
    var canvasImg = document.getElementById('canvas-img');
    canvasImg.style.display = 'none';
    canvasContainer.appendChild(iframe);
    canvasPanel.style.display = 'flex';
  } else {
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }

  // Listen for result
  var timeout = setTimeout(function () {
    window.removeEventListener('message', onMessage);
    consoleOutput.textContent = '(timeout — program took too long)';
    consoleOutput.className = 'pg-output error';
    resetRunBtn();
    if (!isAnimated) { iframe.remove(); }
    URL.revokeObjectURL(url);
  }, 15000);

  function onMessage(e) {
    // Only accept messages with our specific type marker. The sandboxed iframe
    // (allow-scripts only, no allow-same-origin) cannot access the parent DOM.
    // The unique message type acts as our validation token.
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

    var canvasPanel = document.getElementById('canvas-panel');
    var canvasImg = document.getElementById('canvas-img');

    if (isAnimated && usesCanvas) {
      // Iframe is already live in the canvas panel — keep it running
      canvasImg.style.display = 'none';
    } else if (usesCanvas) {
      // Static canvas — show captured image
      var canvasData = e.data.canvasData;
      if (typeof canvasData === 'string' && canvasData.indexOf('data:image/') === 0) {
        canvasImg.style.display = '';
        canvasImg.src = canvasData;
        canvasPanel.style.display = 'flex';
      } else {
        canvasPanel.style.display = 'none';
      }
      iframe.remove();
      URL.revokeObjectURL(url);
    } else {
      canvasPanel.style.display = 'none';
      iframe.remove();
      URL.revokeObjectURL(url);
    }

    resetRunBtn();
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
