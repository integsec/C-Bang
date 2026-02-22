# Fullstack App Demo

A complete blog platform demonstrating every major C! feature working together.

## Architecture

```
BlogPlatform
├── Backend Server (native binary)
│   ├── REST API with JWT auth
│   ├── Rate limiting & CORS
│   └── Blockchain verification endpoint
├── Frontend (WASM in browser)
│   ├── Post listing with pagination
│   ├── Post viewer with on-chain verification badge
│   └── Post editor (authenticated)
├── Smart Contract (EVM)
│   └── ContentRegistry (proof of authorship)
└── Background Actor
    └── ContentProcessor (slug gen + blockchain registration)
```

## Features Demonstrated

- **Shared types** across all 4 layers
- **Auth middleware** with role-based access
- **Smart contract** for proof-of-authorship
- **Actor-based** background processing
- **Refined types** for input validation
- **Intent annotations** on every function
- **Formal verification** of contract invariants

## Run

```bash
# Start with local blockchain testnet
cbang run main.cb --with-testnet

# Or connect to a real network
cbang run main.cb --network sepolia
```

## What to Try

1. Create a post — see it get registered on-chain automatically
2. Check `/api/posts/:id/verify` — see the blockchain proof
3. Try publishing someone else's post — see the auth system reject it
4. Kill the ContentProcessor actor — see the supervision tree restart it
