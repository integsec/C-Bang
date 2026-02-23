# C! GUI Framework Design

**Date:** 2026-02-22
**Status:** Draft
**Authors:** Human-AI Collaborative Design

---

## Motivation

Modern GUI frameworks (SwiftUI, Flutter, Jetpack Compose) have converged on declarative, component-based architectures. However, they all share common weaknesses: resource leaks from forgotten subscriptions, data races from mutable shared state, inaccessible UIs shipped because accessibility is opt-in, and platform lock-in requiring separate codebases per target.

C! already has the language primitives to solve each of these structurally: linear types guarantee resource cleanup, actors eliminate shared mutable state, intent annotations make accessibility compiler-verified, and multi-target compilation handles portability. Rather than bolt a GUI library onto the language, the C! GUI framework makes these guarantees intrinsic to every component a developer writes.

The goal is a single declarative UI definition that renders to:

- **Web** — WASM + Canvas/DOM
- **Desktop** — Native platform APIs (Win32, Cocoa, GTK)
- **Terminal** — Text-based TUI

---

## Design

### Component Model

Every UI component in C! is an **actor**. This is not a metaphor — components literally are actors from the concurrency model, receiving messages and holding isolated state. There is no distinction between "UI state management" and "application state management"; they are the same mechanism.

```
@intent("Display a click counter with accessible labeling.")
actor Counter {
    state count: i32 = 0

    on Increment {
        count += 1;
    }

    fn view(self) -> View {
        Column(spacing: 8) {
            Text("Count: {self.count}")
                .font(.title)
                .aria_label("Current count is {self.count}")

            Button("Increment") {
                self.send(Increment);
            }
                .aria_label("Increase the counter by one")
        }
        .padding(16)
    }
}
```

The `view` function is **pure** — it reads actor state and returns a declarative view tree. The framework calls `view` after every state-changing message. No manual `setState` or `notifyListeners` calls.

**Props vs. state.** Actors receive immutable configuration through their constructor (props) and hold mutable state internally. Props are borrowed references owned by the parent; state is owned by the actor.

```
actor UserCard(user: &User, on_select: fn(UserId)) {
    state expanded: bool = false

    on ToggleExpand {
        expanded = !expanded;
    }

    fn view(self) -> View {
        Card {
            Text(self.user.name).font(.heading)

            if self.expanded {
                Text(self.user.email).font(.body)
                Button("Select") {
                    (self.on_select)(self.user.id);
                }
            }

            Button(self.expanded ? "Collapse" : "Expand") {
                self.send(ToggleExpand);
            }
        }
    }
}
```

### Linear Resource Ownership

UI elements routinely hold expensive resources: GPU textures, file handles for images, WebSocket connections feeding live data, event handler registrations. In every existing framework, forgetting to dispose of these is a runtime bug caught (if ever) by profiling.

In C!, these resources have linear types. The component actor **owns** them, and the compiler enforces that when the actor is removed from the view tree, all owned resources are consumed.

```
actor LiveChart(feed_url: String) {
    state connection: own WebSocket
    state texture: own GpuTexture

    fn init(self) {
        self.connection = WebSocket::connect(self.feed_url);
        self.texture = GpuTexture::allocate(800, 600);
    }

    // Compiler ERROR if drop() does not consume connection and texture.
    fn drop(self) {
        self.connection.close();
        self.texture.release();
    }

    fn view(self) -> View {
        Canvas(width: 800, height: 600, texture: &self.texture)
    }
}
```

If the developer forgets `drop` or forgets to consume a resource inside it, the program does not compile. Resource leaks in the UI layer become impossible by construction.

### Layout Engine

C! uses a **constraint-based flexbox model**. Layout is expressed through composable container elements, each with directional flow and alignment properties.

```
fn view(self) -> View {
    Row(spacing: 12, align: .center) {
        Image(src: self.avatar_url)
            .size(48, 48)
            .clip(.circle)

        Column(spacing: 4) {
            Text(self.name).font(.heading)
            Text(self.role).font(.caption).color(.secondary)
        }
        .flex(1)

        Spacer()

        Badge(self.status)
    }
    .padding(horizontal: 16, vertical: 12)
}
```

**Core containers:**

| Container | Behavior |
|-----------|----------|
| `Row` | Horizontal flow, wraps or clips |
| `Column` | Vertical flow |
| `Stack` | Z-axis overlay |
| `Grid(cols, rows)` | 2D grid with named areas |
| `Scroll(axis)` | Scrollable region |

**Sizing model.** Every element has intrinsic size, optional fixed size, flex weight, and min/max constraints. The layout solver runs in a single measure-then-arrange pass, top-down. No iterative constraint solving — this keeps layout deterministic and fast.

### Event System

Events are **typed actor messages**. There is no string-based event dispatch, no untyped callback soup.

```
type ButtonEvent = Pressed | LongPressed(duration: Duration) | Released

actor FormField {
    state value: String = ""

    on TextChanged(new_value: String) {
        value = new_value;
    }

    on Submit {
        self.parent.send(FormSubmitted(value: self.value));
    }

    fn view(self) -> View {
        TextInput(value: &self.value)
            .on_change(|v| self.send(TextChanged(v)))
            .on_submit(|| self.send(Submit))
    }
}
```

Events propagate through the actor hierarchy. A child actor sends messages to its parent through `self.parent.send(...)`. This replaces bubbling/capturing with explicit, type-checked message passing. The compiler verifies that the parent actor handles every message type its children can send, eliminating "unhandled event" bugs.

### Styling and Themes

Styling uses a **typed property system**, not CSS strings. Every style property is a typed value checked at compile time.

```
theme AppTheme {
    colors {
        primary: #2563EB,
        secondary: #64748B,
        surface: #FFFFFF,
        error: #DC2626,
    }
    fonts {
        heading: Font("Inter", weight: .bold, size: 18),
        body: Font("Inter", weight: .regular, size: 14),
        caption: Font("Inter", weight: .light, size: 12),
    }
    spacing {
        xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
    }
    corners {
        default: 8,
        pill: 9999,
    }
}

// Applied at root
App(theme: AppTheme) {
    Counter()
}
```

Elements reference theme tokens through the `.font(.heading)`, `.color(.primary)` modifiers. Platform renderers map these tokens to native equivalents where possible (system font, platform accent color). Custom values work everywhere.

### Accessibility Through Intent Annotations

Accessibility is not an afterthought — it is a **compiler-verified requirement**. The `@intent(accessible)` annotation on a component triggers static checks:

1. Every `Image` must have an `alt` or `aria_label`.
2. Every `Button` must have a text label or `aria_label`.
3. Interactive elements must have sufficient size (minimum 44x44 logical pixels).
4. Color contrast between text and background must meet WCAG AA ratio.
5. Focus order must follow a logical reading sequence.

```
@intent(accessible)
actor LoginForm {
    state email: String = ""
    state password: String = ""

    fn view(self) -> View {
        Form {
            // Compiler verifies label associations
            Label("Email address", for: "email_input")
            TextInput(id: "email_input", value: &self.email)

            Label("Password", for: "password_input")
            TextInput(id: "password_input", value: &self.password, secure: true)

            Button("Sign in") {
                self.send(Submit);
            }
            // Compiler ERROR: Button without aria_label is acceptable here
            // because it has a text child. But if the text were removed,
            // the compiler would flag it.
        }
    }
}
```

A component without `@intent(accessible)` compiles normally but produces a compiler **warning** suggesting the annotation. Teams can promote this to an error with `cbang check --strict-accessibility`.

### Platform Abstraction

The framework defines a `Renderer` trait. Each target implements this trait:

```
trait Renderer {
    fn create_text(props: TextProps) -> own RenderNode with GPU
    fn create_rect(props: RectProps) -> own RenderNode with GPU
    fn create_image(src: ImageSource) -> own RenderNode with GPU, IO
    fn submit_tree(root: own RenderNode) with GPU
    fn measure_text(text: &str, font: &Font) -> Size
}
```

**Bundled renderers:**

| Renderer | Target | Strategy |
|----------|--------|----------|
| `WasmCanvasRenderer` | Web browsers | WASM module drawing to HTML5 Canvas |
| `WasmDomRenderer` | Web browsers | WASM generating DOM nodes (for SEO/SSR) |
| `Win32Renderer` | Windows | Direct2D / WinUI composition |
| `CocoaRenderer` | macOS / iOS | Core Animation layers |
| `GtkRenderer` | Linux | GTK4 widget mapping |
| `TermRenderer` | Any terminal | ANSI escape sequences, box-drawing |

The effect system ensures renderers declare their side effects (`GPU`, `IO`). Linear ownership of `RenderNode` guarantees GPU resources are released when nodes leave the tree.

### Reactive State

State changes flow through actor messages. The framework detects which state fields `view` reads and only re-renders when those fields change (fine-grained reactivity).

For cross-component shared state, C! uses **shared actors** — actors accessible by name within a subtree:

```
@intent("Global application state providing user session data.")
actor AppState {
    state user: Option<User> = None
    state theme_mode: Light | Dark = Light

    on Login(user: User) { self.user = Some(user); }
    on Logout { self.user = None; }
    on ToggleTheme {
        self.theme_mode = match self.theme_mode {
            Light => Dark,
            Dark => Light,
        };
    }
}

// Any descendant can reference a shared actor
actor NavBar {
    use app: AppState  // binds to nearest ancestor AppState

    fn view(self) -> View {
        Row {
            Text("C! App").font(.heading)
            Spacer()
            match self.app.user {
                Some(u) => Text("Hi, {u.name}"),
                None => Button("Sign in") {
                    self.app.send(Login(prompt_login()));
                },
            }
        }
    }
}
```

The `use` keyword binds a child actor to a shared ancestor actor. Messages flow through the actor hierarchy — no global mutable singletons, no provider/consumer ceremony. The actor model's isolation guarantees still apply: only one message is processed at a time, so state updates are serializable.

---

## Comparisons

| Aspect | SwiftUI | Flutter | React | Elm | **C!** |
|--------|---------|---------|-------|-----|--------|
| State model | `@State` property wrappers | `setState` + InheritedWidget | Hooks / signals | Centralized `Model` | Actor messages |
| Resource cleanup | `onDisappear` (manual) | `dispose()` (manual) | `useEffect` cleanup (manual) | N/A (no side effects) | **Linear types (compiler-enforced)** |
| Accessibility | Runtime audit tool | Semantics widget (opt-in) | aria-* attributes (opt-in) | Elm-html attributes (opt-in) | **Intent annotations (compiler-verified)** |
| Platform targets | Apple only | Mobile + desktop + web | Web (+ React Native) | Web only | **Native + WASM + Terminal** |
| Event typing | Strongly typed | Partially typed | Weakly typed | Strongly typed (Msg) | **Strongly typed (actor messages)** |
| Concurrency safety | MainActor (Swift 6) | Single-threaded | Single-threaded | Single-threaded | **Actor isolation (structural)** |

**What C! learns from each:**

- **SwiftUI:** Declarative view builder syntax, modifier chains, view-as-function-of-state paradigm.
- **Flutter:** Single-codebase multi-platform ambition, widget composition over inheritance.
- **React:** Component-as-unit-of-reuse, unidirectional data flow, virtual DOM diffing.
- **Elm:** Messages as the only way to change state, compiler-guaranteed exhaustive handling, no runtime exceptions.

**What C! does differently:** Resource management is a type system guarantee, not a developer discipline. Accessibility is a compiler check, not a linter suggestion. Cross-platform rendering is a trait, not a separate framework. Concurrency safety comes from the actor model, not from restricting everything to a main thread.

---

## Trade-offs and Alternatives Considered

**Retained-mode vs. immediate-mode.** We chose retained-mode (declarative view tree, framework diffs and patches) over immediate-mode (re-draw every frame). Immediate-mode is simpler but wastes GPU resources and makes accessibility harder. The retained tree enables efficient diffing and semantic tree extraction for screen readers.

**DOM-based web rendering vs. Canvas.** We provide both. `WasmDomRenderer` generates real DOM nodes for SEO and native browser accessibility. `WasmCanvasRenderer` draws to a Canvas for pixel-perfect consistency and game-like UIs. Developers choose per-component.

**CSS-in-C! vs. typed styles.** We rejected CSS strings entirely. Typed style properties catch errors at compile time and port cleanly to non-web targets. The cost is that web developers cannot paste CSS, but the gain is cross-platform consistency and type safety.

**Global state store vs. actor hierarchy.** Elm and Redux use a single global store. We use the actor hierarchy because it matches C!'s concurrency model and avoids a global mutable singleton. The `use` binding provides ergonomics comparable to React Context without the re-render storms.

---

## Implementation Roadmap

### Phase 1 — Core Framework (Foundation)

- View trait and basic element types (`Text`, `Button`, `Column`, `Row`, `Stack`)
- Actor-based component model with `view()` rendering
- Simple layout solver (single-pass flexbox)
- `TermRenderer` — terminal output for rapid iteration without GPU dependencies
- Basic event handling through actor messages

### Phase 2 — Styling and Layout

- Theme system with typed tokens
- Full modifier chain API (`.font()`, `.color()`, `.padding()`, etc.)
- `Grid` container, `Scroll`, `Spacer`
- Style inheritance through the view tree
- `WasmCanvasRenderer` — browser target via Canvas

### Phase 3 — Accessibility and Platform Renderers

- `@intent(accessible)` compiler checks (alt text, label, contrast, focus order)
- Semantic tree extraction for screen readers
- `WasmDomRenderer` — DOM-based web target
- `Win32Renderer` or `CocoaRenderer` — first native desktop target

### Phase 4 — Advanced Features

- Animation system (spring-based, interruptible)
- Gesture recognizer actors
- Form validation with refined types
- Navigation and routing actors
- Remaining native platform renderers
- Hot-reload support during development

---

## Open Questions

1. **View diffing algorithm.** Should we use a keyed list diff (React-style) or structural identity (SwiftUI-style)? Structural identity is simpler but breaks with dynamic lists.
2. **Custom drawing.** Should `Canvas` expose a raw drawing API per-renderer, or should we define a renderer-agnostic vector drawing trait?
3. **Server-side rendering.** For the WASM DOM target, should the framework support SSR by running the actor tree on the server and serializing the initial view?

---

## Open Source

- **Repository:** github.com/integsec/C-Bang
- **License:** Apache 2.0
- **Contributors:** Humans and AI agents equally welcome
