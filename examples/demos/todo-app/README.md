# Todo App Demo

A full-stack todo application demonstrating C!'s unified web development model.

## Features

- Shared types between frontend and backend
- Type-safe API routes
- Reactive WASM frontend components
- Refined types for input validation
- Pattern matching for state management

## Run

```bash
cbang run main.cb
# Opens at http://localhost:3000
```

## Architecture

```
main.cb
├── Shared Types     → Used by both frontend and backend
├── Backend Server   → Native binary serving API + static files
└── Frontend App     → Compiled to WASM, runs in browser
```

## What to Try

1. Change `String{len: 1..200}` to `String{len: 1..10}` — see validation change everywhere
2. Add a new field to `Todo` — compiler shows every place that needs updating
3. Remove a `Priority` variant — exhaustiveness checking catches all missing cases
