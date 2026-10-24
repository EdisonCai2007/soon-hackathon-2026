// Who connects to whom. Each browser sends its camera straight to every other one, so the only thing
// the room settles is which side of a pair makes the offer.
export const connectionConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
  bundlePolicy: 'max-bundle',
}

/** Exactly one side of each pair offers, decided by the two ids, so neither waits and neither clashes. */
export const shouldOffer = (selfId: string, peerId: string): boolean => selfId < peerId
