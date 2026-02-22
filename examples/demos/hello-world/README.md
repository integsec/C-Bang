# Hello World Demo

Your first C! program. Demonstrates:

- Entry point and basic syntax
- Intent annotations
- Refined types (value constraints)
- Pattern matching
- Option type (no null!)

## Run

```bash
cbang run main.cb
```

## What to Try

1. Change the port to `0` — see the compile error from the refined type
2. Remove a `match` arm — see the exhaustiveness check
3. Try using a variable after it's been moved — see the linear type system
