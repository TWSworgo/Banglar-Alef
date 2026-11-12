# বাংলার আলেফ

A browser-based 3D Dhaka city-driving game built with an original Three.js implementation.

## Gameplay
- Drive a battery-powered CNG auto through a procedurally generated city with a live speedometer and day/night lighting.
- Pick up passengers at green markers and deliver them safely to yellow destinations.
- Earn points for completed passenger trips; collisions reduce the score and count as accidents.
- Stop carefully near pickup and drop-off markers and earn a small safe-stop bonus at red traffic lights.
- Manage battery charge with roadside charging points.
- Navigate traffic, traffic lights, pedestrians, buses, trucks, CNGs, vans, SUVs and other vehicles.
- Use the minimap, camera views, horn, pause menu and graphics/audio settings.

## Controls
- **Keyboard:** W / Arrow Up to accelerate, S / Arrow Down to brake or reverse, A/D or Left/Right to steer.
- **H:** horn · **C:** change camera · **P:** pause.
- **Mobile:** on-screen steering, brake and throttle buttons.

## Run locally
Serve the repository with any static HTTP server and open the local address. Three.js is loaded from jsDelivr, so an internet connection is required on first load.

## Automated checks
The GitHub Actions workflow runs a JavaScript syntax check and a Playwright Chromium smoke test on desktop and mobile-sized viewports. The browser test checks WebGL initialization, driving input, HUD, graphics/audio settings and pause/resume.

## Current limitations
This is an original safe-driving game inspired by Dhaka street traffic, not a feature-for-feature copy of another game. The city is a procedural grid rather than a surveyed Dhaka road network; traffic and pedestrian behavior are simplified; and real-device testing, deeper mission content, accessibility review and performance profiling on lower-end phones remain outstanding. A passing CI smoke test is not a production-readiness certification.
