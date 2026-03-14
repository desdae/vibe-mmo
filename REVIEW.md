# Code Review - develop branch

## 1. Architectural Issues

### 1.1 Monolithic Files
- **`server.js`**: This file has grown too large and handles too many responsibilities, including configuration loading, service initialization, and wiring up the entire game logic.
- **`public/client.js`**: An extremely large file (>8000 lines) that handles everything on the client side: UI, rendering (both Canvas and PIXI), networking, and game logic. This makes it very difficult to maintain and test.

**Recommendation**: Break these files down into smaller, focused modules. Use a modular approach for the client-side code (e.g., separate modules for rendering, UI components, and networking).

### 1.2 Tight Coupling
- The server initialization in `server.js` shows tight coupling between different systems (gameplay, network, runtime). Many tools and services are passed as deep dependencies, making the system brittle.

**Recommendation**: Implement a more robust dependency injection or service locator pattern to manage system components.

---

## 2. Performance Concerns

### 2.1 World State & Spatial Indexing
- **`server/runtime/world-state.js`**: Uses basic `Map` objects to store entities. As the number of players, mobs, and projectiles increases, operations like collision detection and visibility filtering (currently $O(N^2)$ or $O(N \cdot M)$) will become performance bottlenecks.

**Recommendation**: Implement a spatial partitioning system (e.g., Quadtree or Grid-based indexing) to optimize spatial queries.

### 2.2 Game Loop Consistency
- **`server/runtime/game-loop.js`**: Uses `setInterval`, which does not guarantee consistent timing and can drift if the tick execution takes significant time.

**Recommendation**: Use a more robust game loop implementation that accounts for execution time and maintains a consistent tick rate (e.g., using `setImmediate` or `setTimeout` with delta time calculation).

---

## 3. Networking & Security

### 3.1 Mixed Protocol
- The system uses a mix of JSON and a custom binary protocol. While the binary protocol (with quantization) is efficient, having a fragmented communication layer adds complexity.

**Recommendation**: Standardize the communication protocol. Move more high-frequency updates to the binary protocol.

### 3.2 Lack of Validation & Rate Limiting
- **`server/network/message-router.js`**: Lacks robust input validation and rate limiting for client messages. This could lead to server crashes or exploits.

**Recommendation**: Add a validation layer for all incoming messages and implement rate limiting per connection.

---

## 4. Code Quality & Maintenance

### 4.1 Global State in Client
- The client heavily relies on global state and shared variables, making it prone to side effects and difficult to debug.

**Recommendation**: Encapsulate state within dedicated state management modules.

### 4.2 Error Handling
- Error handling in several places is minimal (e.g., catching errors and just logging them or sending a generic error message to the client).

**Recommendation**: Implement more granular error handling and reporting.

---

## 5. Bugs & Regressions

### 5.1 Broken Test Suite
- **`scripts/test-equipment-affixes.js`**: The test is currently failing because it calls `createPlayerTickSystem` without providing the required `tickPlayerBuffs` dependency.
- **Playwright Tests**: `test:equipment:smoke` and `test:talents:smoke` cannot be run in the current environment due to missing `playwright` dependency in `node_modules`.

**Recommendation**: Fix the `test-equipment-affixes.js` script by providing the missing dependency. Ensure the environment is properly set up for Playwright tests.
