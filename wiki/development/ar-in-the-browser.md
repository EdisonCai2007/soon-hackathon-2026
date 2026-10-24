# AR in the browser

What a web page can and can not learn about where a phone is in a real room, checked on real devices in October 2026. A page can always read which way a phone faces, from its sensors. **Where** it is standing is the hard part, and the answer differs by platform.

## Android Chrome has it; iOS Safari does not

- **Android Chrome:** `navigator.xr.requestSession('immersive-ar')` with a `local-floor` reference space gives a pose per frame, in metres, from ARCore. Nothing to install, no third party, no key. This is the path to take whenever an Android phone can be the one in the room.
- **iOS Safari:** no WebXR at all. [caniuse](https://caniuse.com/webxr) shows it unsupported through iOS 27, and Apple states that `immersive-ar` sessions "are not supported on visionOS or iOS" and the Settings flag is non-functional ([Apple Developer Forums](https://developer.apple.com/forums/thread/756850)). An iPhone joins such an experience as an ordinary viewer.

Two ways round the iPhone, neither free of cost:

- **[8th Wall](https://8thwall.org)**, which became free and open in February 2026, ships its tracking engine as a binary on npm (`@8thwall/engine-binary`) under a limited-use licence, including SLAM and image targets. It does the tracking itself in WebAssembly, so it runs in iOS Safari 16.4+ with no app key and no account. It loads and runs there; getting it to start tracking took more than a short spike, so treat it as a day's work, not an afternoon's.
- **[Variant Launch](https://launch.variant3d.com)** gets real WebXR on iOS by opening the page inside an App Clip viewer. It works, at the price of an Apple prompt in front of the experience and a paid tier past 3k views a month.

## Lining a phone up with a scan needs a known spot

A phone's tracking is relative to wherever the session started, so it has to be tied to the real room once.

- **Image tracking is not available on stable Chrome.** The WebXR image-tracking feature is [gated behind `#webxr-incubations`](https://github.com/chromium/chromium/commit/cdd4527accb10c34735b16c05b564bd4373d3855) — it works with the flag on, which is fine for a phone you own and useless for anyone else's.
- **So mark the floor.** Tape a spot and an arrow, have the person stand there and confirm, and take that spot's position and facing from the scan's own data. Every later pose is placed against it. The accuracy is however carefully they stood, which is close enough to put a person in a room and cheap enough to repeat.

## Trying it on a real phone

A page that asks for the camera needs HTTPS, so a laptop's dev server is not reachable from a phone as-is. `cloudflared tunnel --url http://localhost:<port>` gives a public HTTPS address in seconds with no account. Two things to get right in a throwaway test page: wait for the engine or session to be ready before enabling the button, since a phone connection can take a while over mobile data, and print the error rather than a generic failure — "it doesn't work" and "the script hadn't loaded yet" look identical otherwise.

Part of [development](README.md). For the room these phones stream into, see [live rooms](../stack/live-rooms.md).
