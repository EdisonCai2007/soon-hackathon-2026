# Room scan demo

## Purpose

Keep a recorded room's Gaussian-splat artifact and its local first-person viewer available for hackathon review and reproducible development.

## ADDED Requirements

### Requirement: Local scan viewing
The experiment SHALL render the bundled trained Gaussian-splat PLY from a local server without requiring a viewer build or external CDN.

#### Scenario: Open the bundled scan
- **WHEN** the documented static server is running and the viewer is opened
- **THEN** the room renders with source-camera presets, cutaway controls, and the point-cloud comparison.

### Requirement: First-person camera
The viewer SHALL use W/A/S/D for horizontal movement, Q/E for down/up movement, and drag for looking from the camera's current position.

#### Scenario: Look from a fixed location
- **WHEN** the user drags the scene without movement keys
- **THEN** camera orientation changes while its position remains fixed.

#### Scenario: Lose input focus
- **WHEN** the viewer loses focus while a movement key is held
- **THEN** movement stops until a fresh key press.

### Requirement: Processing handoff
The experiment SHALL include portable processing scripts and source/version notes without source footage, credentials, or model weights.

#### Scenario: Reconstruct from separately supplied footage
- **WHEN** a developer follows the processing instructions with their own video and upstream dependencies
- **THEN** the scripts accept explicit paths and can prepare the fitted PLY and camera metadata for the viewer.
