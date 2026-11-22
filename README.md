# Tacoma Telemetry

A live vehicle telemetry system for my 2011 Toyota Tacoma. A C++ backend produces
vehicle data (simulated first, real OBD-II later), and a React dashboard shows it live.

It is built like a small drone ground control station: a data source streams sensor
readings, a multithreaded pipeline decodes and processes them, and a UI displays them in real time.

## How it works

```
 [ Data source ]  ->  [ Thread-safe queue ]  ->  [ Processing ]  ->  [ WebSocket server ]  ->  [ React dashboard ]
   Simulator              (producer/consumer)      alerts, logging       (JSON, ~10 Hz)           gauges + graphs
   or real OBD-II
```

The data source sits behind one interface (`ITelemetrySource`). The simulator and the
real OBD-II reader both implement it, so the rest of the system doesn't care which one is running.

## Folder layout

```
tacoma-telemetry/
├── backend/                 C++17 (CMake)
│   ├── include/tacoma/      Public headers
│   └── src/
│       ├── core/            Data types, thread-safe queue, ITelemetrySource interface
│       ├── sim/             Simulator (fake Tacoma: RPM, speed, coolant, throttle, load)
│       ├── obd/             Real OBD-II / ELM327 reader (phase 2)
│       ├── transport/       WebSocket server that streams JSON to the dashboard
│       └── app/             main(): wires source -> queue -> processing -> server
│   └── tests/               GoogleTest unit tests
├── frontend/                React + TypeScript (Vite)
│   └── src/
│       ├── components/      Gauges, live graph, alert banner
│       ├── hooks/           useTelemetry (WebSocket connection)
│       └── types/           Telemetry message types
├── data/recordings/         Logged runs for replay (e.g. a Phoenix -> San Diego drive)
├── docs/                    Architecture diagram, design notes, tradeoffs
├── scripts/                 Build/run helpers
├── .github/workflows/       CI: build + test on every push
└── .cursor/rules/           Project rules so Cursor follows our conventions
```

## Phases

1. **Simulator + core pipeline.** Fake Tacoma data flows through a producer/consumer queue and prints to the terminal.
2. **WebSocket + React dashboard.** Live gauges and a scrolling graph.
3. **Logging + replay.** Record a run to a file and play it back through the same pipeline.
4. **Tests + CI + polish.** GoogleTest, GitHub Actions, clang-tidy, architecture diagram.
5. **Real OBD-II.** ELM327 adapter on the truck. Same pipeline, new data source.
6. **Stretch.** Overheat alerts on long climbs (Mountain Springs grade), GPS route, Kalman filter smoothing.

## Planned dependencies

- C++17 or newer, CMake 3.20+
- GoogleTest (tests)
- nlohmann/json (messages)
- A WebSocket library (IXWebSocket or Boost.Beast)
- Node 20+, React, Vite (dashboard)

## Design rules

- Modern C++: RAII, smart pointers, no raw `new`/`delete`.
- No shared mutable state without a mutex or atomic, and a comment saying why.
- Every module gets unit tests.
- Keep the data source behind an interface so simulator and real hardware are interchangeable.

## Status

Phase 1 in progress...
