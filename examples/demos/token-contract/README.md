# Token Contract Demo

An ERC20 token demonstrating C!'s smart contract security guarantees.

## Security Guarantees (by construction)

| Vulnerability | Status | How |
|---|---|---|
| Reentrancy | Impossible | Linear state prevents re-entry |
| Integer overflow | Impossible | Checked arithmetic by default |
| Double-spend | Impossible | Linear types |
| Unauthorized mint | Impossible | `#[auth(owner)]` enforced |

## Deploy

```bash
# Deploy to local testnet
cbang deploy main.cb --target evm --network local

# Deploy to testnet
cbang deploy main.cb --target evm --network sepolia

# Verify contract
cbang verify main.cb
```

## What to Try

1. Remove a `verify!` — see the intent mismatch warning
2. Try to re-enter `transfer` — see the linear state compile error
3. Run `cbang verify` — see the formal verification proving all invariants
