# বাংলার আলেফ

A browser-based 3D Dhaka-inspired arcade driving game built with an original Three.js implementation.

## Gameplay
- Drive a battery-powered CNG auto through a procedural city with traffic, pedestrians, street furniture and day/night lighting.
- Avoid traffic and pedestrians while managing vehicle speed, collisions and battery charge.
- A pursuing crowd gradually increases the pressure meter; being surrounded ends the run.
- Collisions add to the fictional “জাতীয় ক্ষতি” score and increase crowd pressure.
- Find roadside charging points to restore battery charge.
- Use the minimap, three camera views, horn, pause menu and graphics/audio settings.
- Keyboard and touch controls are supported.

## Controls
- **Keyboard:** W / Arrow Up to accelerate, S / Arrow Down to brake or reverse, A/D or Left/Right to steer.
- **H:** horn · **C:** change camera · **P:** pause.
- **Mobile:** on-screen steering, brake and throttle buttons.

## Run locally
Serve the repository with any static HTTP server and open its local address. Three.js is loaded from jsDelivr, so an internet connection is required.

## Automated checks
GitHub Actions checks JavaScript syntax and runs Playwright Chromium smoke tests on desktop and mobile-sized viewports. These checks are not equivalent to testing on physical Android devices.

## Known limitations
The city is procedurally generated and is not a surveyed or complete Dhaka road network. Vehicle routing, pedestrian behavior and crowd pursuit are simplified game AI. The game still needs physical-device testing across representative Android phones, performance profiling, accessibility review, browser compatibility checks and extended gameplay balancing before it can be called production-ready.
