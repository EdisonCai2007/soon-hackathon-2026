import { expect, it } from 'vitest'
import { arrivalFrom, cameraLink, inviteLink, isRoomId } from './invite'

const id = '0123456789abcdef0123'

it('walks the scan alone when the address names no room', () => {
  for (const tail of [undefined, '', '/', 'r', 'r/', 'phone', 'elsewhere/' + id, `r/${id}/more`, 'r/NOTHEX']) {
    expect(arrivalFrom(tail)).toEqual({ kind: 'alone' })
  }
})

it('joins as a guest or as the camera from the address', () => {
  expect(arrivalFrom(`r/${id}`)).toEqual({ kind: 'guest', roomId: id })
  expect(arrivalFrom(`/r/${id}/`)).toEqual({ kind: 'guest', roomId: id })
  expect(arrivalFrom(`phone/${id}`)).toEqual({ kind: 'camera', roomId: id })
})

it('knows a room id', () => {
  expect(isRoomId(id)).toBe(true)
  expect(isRoomId(id.toUpperCase())).toBe(false)
  expect(isRoomId('')).toBe(false)
})

it('builds the link to share and the one a phone opens', () => {
  expect(inviteLink('https://site.example', 'roam', id)).toBe(`https://site.example/apps/roam/r/${id}`)
  expect(cameraLink('https://site.example', 'roam', id)).toBe(`https://site.example/apps/roam/phone/${id}`)
  // What the host shares is what another page reads back.
  expect(arrivalFrom(new URL(inviteLink('https://site.example', 'roam', id)).pathname.replace('/apps/roam/', ''))).toEqual({ kind: 'guest', roomId: id })
})
