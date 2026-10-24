// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { playNow } from './play'

const element = (play?: () => unknown) => ({ play } as unknown as HTMLMediaElement)

it('asks an element to play, whatever it answers', async () => {
  const started = vi.fn(() => Promise.resolve())
  playNow(element(started))
  expect(started).toHaveBeenCalled()

  // Autoplay refused, which is a browser's choice and not a failure here.
  playNow(element(() => Promise.reject(new Error('blocked'))))
  // A browser that answers with nothing at all.
  playNow(element(() => undefined))
  playNow(element(undefined))
  await Promise.resolve()
})
