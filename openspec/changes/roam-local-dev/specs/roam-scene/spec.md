## MODIFIED Requirements

### Requirement: Scan renders on the site
The ROAM app at `/apps/roam/` SHALL load the compressed Gaussian-splat room scan from the site's own static assets, with no external CDN, and render it oriented by the scene metadata's rotation and translation. It SHALL draw the scan wherever the app runs — on a developer's own computer as on the deployed site — and the path that draws it SHALL never be switched off: a machine that keeps up draws every splat through it, uncapped.

#### Scenario: Open ROAM
- **WHEN** a person opens `/apps/roam/` on a preview or the live site
- **THEN** the scanned room renders from the first source-camera view, and the page states the splat and view counts

#### Scenario: Scan cannot load
- **WHEN** the scan or its metadata fails to load, or the browser has no WebGL
- **THEN** the page shows a plain message and, for a failed load, a *Try again* action, instead of a blank canvas

#### Scenario: Open ROAM where it is built
- **WHEN** a person opens `/apps/roam/` on their own computer against their own server
- **THEN** the scanned room renders there too, at full detail, rather than leaving an empty view with nothing said and nothing fetched
