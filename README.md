# বাংলার আলেফ

A browser-based 3D Dhaka city-driving game built with an original Three.js implementation.

## Gameplay
- Drive a battery-powered CNG auto through a procedural Dhaka-inspired city.
- Pick up passengers at green markers and deliver them safely to yellow destinations.
- Earn points for successful passenger trips and safe stops at red traffic lights.
- Collisions reduce the score, drain battery and count as accidents; repeated accidents end the run.
- Manage battery charge with roadside charging points.
- Navigate traffic signals, pedestrians, buses, trucks, CNGs, vans, SUVs and other vehicles.
- Use the minimap, speedometer, three camera views, horn, pause menu and graphics/audio settings.
- The city has a day/night cycle and roadside shops and stalls.

## Controls
- **Keyboard:** W / Arrow Up to accelerate, S / Arrow Down to brake or reverse, A/D or Left/Right to steer.
- **H:** horn · **C:** change camera · **P:** pause.
- **Mobile:** on-screen steering, brake and throttle buttons.

## Run locally
Serve the repository with any static HTTP server and open the local address. Three.js is loaded from jsDelivr, so an internet connection is required.

## Automated checks
GitHub Actions checks JavaScript syntax and runs Playwright Chromium smoke tests on desktop and mobile-sized viewports. The mission test checks passenger pickup and safe dropoff. These checks are not equivalent to testing on physical Android devices.

## Known limitations
The city is procedurally generated and is not a surveyed or complete Dhaka road network. Traffic routing and pedestrian behavior are simplified. The game still needs physical-device testing across representative Android phones, performance profiling, accessibility review, browser compatibility checks and extended gameplay balancing before it can be called production-ready.
