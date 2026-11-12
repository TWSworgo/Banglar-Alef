# BANGLAR ALEF — MASTER FEATURE SPECIFICATION
## Complete Production Game · Fresh Gameplay Build

**Game:** বাংলার আলেফ — A Dhaka CNG Life Simulator  
**Tagline:** একটা সিএনজি। একটা শহর। হাজারো গল্প।  
**Platforms:** Android Browser + Desktop Browser  
**Technology:** HTML, CSS, JavaScript, Three.js, WebGL  
**Mode:** Offline Single-player  
**Rule:** This specification replaces the earlier Lab/Showcase-oriented checklist. A feature is complete only when it works in the actual game, is integrated with the shared game state, and passes its acceptance tests.

## Feature 01 — Complete Game Foundation
- [x] Central game-state schema and lifecycle transitions.
- [x] New Game creates a clean player profile and initial state.
- [x] Continue loads a validated saved game.
- [x] Versioned save format with corruption/incompatibility rejection.
- [x] Autosave during gameplay, on pause, and before page exit.
- [x] Restore player money, battery, vehicle position/heading and active mission progress.
- [x] Pause, resume and restart controls.
- [x] Completion-state screen and credits route foundation.
- [x] Loading screen waits for actual document assets and fonts; no fabricated progress milestones.
- [x] Full browser acceptance and deployment verification for the foundation.

**Integration contract:** all later gameplay systems must read/write this shared state; their own feature-level integration remains part of those features’ acceptance tests.

**Implementation:** `game-core.js`, `game.js`, `game.html`, `app.js`, `index.html`. Save key: `banglar-alef.game-save.v1`. Unit tests: `.github/scripts/game-core.test.mjs` (passed). Browser acceptance: `.github/scripts/game-browser-test.mjs` (passed in GitHub Actions run `43238971196`). GitHub Pages deployment for commit `c04bbb3fa2c97d3498f0a6bf3155ccd2bb346d48` succeeded.

## Feature 02 — Main Menu & User Interface
- Cinematic main menu, New Game, Continue, Garage, Map, Settings, Controls, Statistics, Credits and Exit.
- Responsive Android/Desktop interface, Bengali/English language support, accessible navigation and settings.
- All visible controls must perform real actions; unavailable systems must not masquerade as functional.

## Feature 03 — Complete 3D Dhaka Open World
- Real Dhaka road network, connected intersections, flyovers, bridges, footpaths and crossings.
- Distinct residential, commercial, market and transport areas.
- Geographically grounded buildings, shops, schools, hospitals, offices, bus/CNG stands and landmarks.
- Minimap, full map, route navigation, seamless area travel, world streaming and caching.

## Feature 04 — Realistic 3D Graphics
- Real-world scale and proportions; high-quality PBR materials, textures, lighting, shadows, reflections and glass.
- Realistic asphalt, concrete, water, vegetation and atmospheric effects.
- Day/sunset/night lighting, rain/wet roads/fog/dust, LOD, culling and GPU/memory optimization.
- Production-quality authored or licensed assets; no placeholder low-poly city assets in the final release.

## Feature 05 — Complete CNG Driving System
- Detailed three-wheeler CNG model with realistic dimensions, wheels, suspension and interior.
- Steering, acceleration, braking, reverse, handbrake, inertia, turning radius and vehicle physics.
- Headlights, brake lights, indicators, horn, motor/engine sound, battery use, damage and repair.
- Multiple camera perspectives and vehicle interaction.

## Feature 06 — AI Traffic System
- Buses, trucks, cars, motorcycles, CNGs, rickshaws and bicycles.
- Lane following, turning, intersection navigation, traffic-light response, braking, overtaking and obstacle avoidance.
- Variable density, traffic jams, collision avoidance, spawning/despawning and area-specific behavior.

## Feature 07 — Pedestrian & NPC System
- Varied human characters, clothing and animations.
- Walking, crossing, waiting, shop/street activity and daily routines.
- NPC reactions to traffic/player, interactions, dialogue, avoidance and performance-aware spawning.

## Feature 08 — Passenger & Journey System
- Waiting passengers, pickup and drop-off, boarding validation and destination selection.
- Passenger dialogue, route/destination markers, minimap navigation and distance.
- Fare calculation, passenger satisfaction, cancellation, ratings, journey history and multiple journey types.

## Feature 09 — Mission & Career System
- Story missions, daily tasks, passenger jobs, timed/special journeys and city challenges.
- Objectives, progression, rewards, unlocks, failure conditions and final story mission.
- Mission state must persist and integrate with the economy and player profile.

## Feature 10 — Economy & Financial System
- Starting money, fare income, charging, repair, upgrades, purchases and daily expenses.
- Player balance, income/expense history, savings, statistics and balanced progression.
- All transactions validated against real gameplay events; no free/demo money injection.

## Feature 11 — Garage & Vehicle Customization
- Functional 3D garage, inspection, vehicle selection and ownership.
- Paint, body, wheels, interior, lights, accessories and performance/battery upgrades.
- Purchases, installation, costs, gameplay effects and persistent customization.

## Feature 12 — Battery & Charging System
- Battery percentage, energy consumption based on driving/load, condition and warnings.
- World charging stations, charging interaction/animation/time/cost and battery upgrades.
- Empty-battery behavior and charging history.

## Feature 13 — Collision & Damage System
- Vehicle/object collision detection and physical response.
- Damage states, handling effects, repair costs, recovery and incident consequences.
- Pedestrian safety logic and non-graphic presentation.

## Feature 14 — Weather & Time Simulation
- Dynamic morning/day/evening/night cycle and sun position.
- Rain, heavy rain, fog, dust, wet roads and puddles.
- Visibility, lighting, traffic and NPC behavior respond to conditions.

## Feature 15 — Sound & Audio System
- CNG motor, horn, tire, braking, traffic, buses, pedestrians, city ambience, rain and passenger voices.
- UI/menu/garage sounds, optional music, spatial audio and independent volume controls.

## Feature 16 — Events & Interactive World
- Police interactions, passenger conversations, roadside events, construction and diversions.
- Random requests, contextual actions, special locations and story events.
- Events must have meaningful gameplay consequences.

## Feature 17 — HUD & In-Game Interface
- Speedometer, battery, money, mission, destination, minimap, route and vehicle status.
- Passenger status, warnings, prompts, pause, results and responsive touch/keyboard controls.
- Every displayed value must read from the real game state.

## Feature 18 — Camera & Driving Controls
- Third-person, first-person/interior and free-look cameras.
- Smoothing, zoom, collision-aware positioning and mobile touch camera controls.
- Android touch steering/pedals, keyboard controls and optional controller/gyroscope support.
- Sensitivity and control-layout settings.

## Feature 19 — Save, Load & Player Progress
- Automatic/manual save, Continue, save validation, migration and corruption recovery.
- Career, missions, money, statistics, vehicles, customization and settings persist.
- Save/load must restore the complete playable state, not just menu preferences.

## Feature 20 — Game Over, Story Ending & Newspaper
- Game-over conditions and result screen.
- Newspaper title: **জীবনের কষ্ট জাতীয় পত্রিকা**.
- Contextual humorous headlines, gameplay statistics, income/loss and incident summary.
- Screenshot generation, save/share/invite, restart and main-menu actions.
- Full story ending and post-game free roam.

## Feature 21 — Production Quality, Optimization & Release
- Full integration, no demo-only systems, fake HUD values or dead buttons.
- No critical JavaScript errors or game-breaking bugs.
- Android/desktop browser compatibility, responsive UI, memory and asset optimization.
- World streaming, low-memory handling, long-session stability and recovery.
- Full gameplay regression, performance, save/load and device testing.
- GitHub Pages deployment, public URL verification, version/release and credits.

## Global Completion Gate
The game is not production-ready until all 21 features are implemented, integrated and tested; a player can start a new game, drive through a substantial city, complete the story, save/continue, use every major system, and reach the ending on supported Android and desktop browsers. A visible model or UI panel alone never counts as a completed feature.
