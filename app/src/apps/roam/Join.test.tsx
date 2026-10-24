// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Join } from './Join'

afterEach(cleanup)

it('takes a name and goes live', () => {
  const joined = vi.fn()
  render(<Join onJoin={joined} />)
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } })
  fireEvent.click(screen.getByRole('button', { name: 'Go live' }))
  expect(joined).toHaveBeenCalledWith('Sam')
})

it('goes live without a name, since the room names a guest for you', () => {
  const joined = vi.fn()
  render(<Join onJoin={joined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Go live' }))
  expect(joined).toHaveBeenCalledWith('')
})

it('says what is shared, and offers the camera role to somebody in the room', () => {
  render(<Join onJoin={vi.fn()} cameraOffer="/apps/roam/phone/r1" />)
  expect(screen.getByText(/Nothing is recorded/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'I’m in the room itself' })).toHaveProperty('href', 'http://localhost:3000/apps/roam/phone/r1')
})
