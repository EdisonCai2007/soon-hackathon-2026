import { describe, expect, it } from 'vitest'
import { isTechnique, lookOf, TECHNIQUE_NAMES, TECHNIQUES, through } from './techniques'

describe('the list of techniques', () => {
  it('holds the three signs, each with a life, a wait and words for the readout', () => {
    expect(TECHNIQUE_NAMES).toEqual(['domain', 'purple', 'blue'])
    for (const name of TECHNIQUE_NAMES) {
      const technique = TECHNIQUES[name]
      expect(technique.life).toBeGreaterThan(0)
      expect(technique.wait).toBeGreaterThan(0)
      expect(technique.sign.length).toBeGreaterThan(0)
      expect(technique.title.length).toBeGreaterThan(0)
    }
  })

  it('tells a known technique from anything else', () => {
    expect(isTechnique('domain')).toBe(true)
    expect(isTechnique('toString')).toBe(false)
    expect(isTechnique(7)).toBe(false)
  })
})

describe('how far through a cast is', () => {
  it('runs from nothing to one across its life', () => {
    expect(through('purple', 1000, 1000)).toBe(0)
    expect(through('purple', 1000, 2300)).toBeCloseTo(0.5)
  })

  it('is over once its life has passed, and is nothing before it starts', () => {
    expect(through('purple', 1000, 3600)).toBe(null)
    expect(through('purple', 1000, 900)).toBe(null)
  })
})

describe('what each technique looks like', () => {
  it('sweeps the domain out, then fades it, flashing as it opens', () => {
    const opening = lookOf('domain', 0)
    expect(opening.dome).toBe(0)
    expect(opening.glow).toBe(1)
    const open = lookOf('domain', 0.5)
    expect(open.dome).toBe(9)
    expect(open.domeFade).toBeCloseTo(0.85)
    expect(open.glow).toBe(0)
    expect(lookOf('domain', 0.99).domeFade).toBeLessThan(0.05)
  })

  it('gathers hollow purple, then sends it across the room', () => {
    const gathering = lookOf('purple', 0)
    expect(gathering.gather).toBeCloseTo(1)
    expect(gathering.orb).toBe(0)
    const met = lookOf('purple', 0.35)
    expect(met.gather).toBe(0)
    expect(met.reach).toBe(0)
    const crossing = lookOf('purple', 0.99)
    expect(crossing.reach).toBeGreaterThan(6)
    expect(crossing.orbFade).toBeLessThan(0.05)
  })

  it('draws the blue inward, then lets it go', () => {
    const pulling = lookOf('blue', 0)
    expect(pulling.orb).toBeCloseTo(1.3)
    expect(pulling.glow).toBe(0)
    expect(lookOf('blue', 0.075).glow).toBeCloseTo(0.2)
    expect(lookOf('blue', 0.15).glow).toBe(0)
    expect(lookOf('blue', 0.5).orbFade).toBeCloseTo(0.9)
    expect(lookOf('blue', 0.9).orbFade).toBeCloseTo(0.45)
  })
})
