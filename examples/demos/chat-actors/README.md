# Chat Actors Demo

A real-time chat application built with C!'s actor model.

## Architecture

```
Application
├── RoomManager (supervises all rooms)
│   ├── Room "general"
│   ├── Room "random"
│   └── Room "c-bang"
├── ClientActor (one per connected user)
└── ChatServer (HTTP + WebSocket)
```

## Features

- Each room is an isolated actor — no shared state, no races
- Supervision trees automatically restart crashed rooms
- Bounded message history (last 500 messages per room)
- Refined types validate usernames and room names at compile time
- WebSocket integration for real-time messaging

## Run

```bash
cbang run main.cb
# Opens at http://localhost:8080
```

## What to Try

1. Connect multiple browsers — see actor message passing in action
2. Kill a room actor — watch supervision tree restart it
3. Try creating a username with special characters — refined type rejects it
