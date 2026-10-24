import { expect, it } from 'vitest'
import { connectionConfig, shouldOffer } from './mesh'

it('has exactly one side of each pair make the offer', () => {
  expect(shouldOffer('a1', 'b2')).toBe(true)
  expect(shouldOffer('b2', 'a1')).toBe(false)
  // Nobody offers to themselves, so a stray own id costs nothing.
  expect(shouldOffer('a1', 'a1')).toBe(false)
})

it('finds its way through a network with one public address and no relay', () => {
  expect(connectionConfig.iceServers).toEqual([{ urls: 'stun:stun.cloudflare.com:3478' }])
})
