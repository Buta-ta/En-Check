// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Crop from '../../components/AdminAvatarCrop'
import {
  avatarCropRect,
  drawAvatarCrop,
  exportAvatarCrop,
  validateAvatarSource,
} from '../../utils/adminAvatarCrop'
let host, root, images, draw, confirm, cancel, blobCallback
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  images = []
  draw = vi.fn()
  confirm = vi.fn()
  cancel = vi.fn()
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        this.naturalWidth = 1200
        this.naturalHeight = 800
        images.push(this)
      }
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: draw,
    clearRect: vi.fn(),
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => {
      blobCallback = callback
    },
  )
  vi.stubGlobal(
    'URL',
    Object.assign(class {}, {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    }),
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const file = () =>
  new File(['fixture'], 'private-photo.jpg', { type: 'image/jpeg' })
async function mount() {
  await act(async () =>
    root.render(<Crop file={file()} onConfirm={confirm} onCancel={cancel} />),
  )
}
it('computes centered portrait and landscape crops and keeps extreme positions inside the source', () => {
  expect(avatarCropRect(1200, 800)).toEqual({ x: 200, y: 0, size: 800 })
  expect(avatarCropRect(800, 1200)).toEqual({ x: 0, y: 200, size: 800 })
  expect(avatarCropRect(1200, 800, 2, 100, 100)).toEqual({
    x: 800,
    y: 400,
    size: 400,
  })
  expect(avatarCropRect(1200, 800, 0, -50, 150)).toEqual({
    x: 0,
    y: 0,
    size: 800,
  })
  for (const args of [
    [0, 800],
    [10000, 10000],
    [NaN, 800],
  ])
    expect(() => avatarCropRect(...args)).toThrow()
})
it('rejects SVG, empty and oversized input before decoding', () => {
  expect(() =>
    validateAvatarSource(new File(['svg'], 'x.svg', { type: 'image/svg+xml' })),
  ).toThrow()
  expect(() =>
    validateAvatarSource(new File([], 'x.png', { type: 'image/png' })),
  ).toThrow()
  expect(() =>
    validateAvatarSource({ type: 'image/png', size: 2097153 }),
  ).toThrow()
  expect(() => validateAvatarSource(file())).not.toThrow()
})
it('renders and exports the same square crop without copying the source file bytes', async () => {
  const canvas = document.createElement('canvas')
  drawAvatarCrop(canvas, { naturalWidth: 1200, naturalHeight: 800 }, 2, 100, 0)
  expect(draw.mock.calls[0].slice(1)).toEqual([
    800, 0, 400, 400, 0, 0, 512, 512,
  ])
  const pending = exportAvatarCrop(canvas)
  blobCallback(new Blob(['encoded'], { type: 'image/webp' }))
  const exported = await pending
  expect(exported.name).toBe('avatar.webp')
  expect(exported.type).toBe('image/webp')
  expect(exported.size).toBe(7)
})
it('correctly labels a PNG encoder fallback and rejects a failed export', async () => {
  const canvas = document.createElement('canvas')
  const fallback = exportAvatarCrop(canvas)
  blobCallback(new Blob(['encoded'], { type: 'image/png' }))
  expect((await fallback).name).toBe('avatar.png')
  const failed = exportAvatarCrop(canvas)
  blobCallback(null)
  await expect(failed).rejects.toThrow()
})
it('waits for decoding, confirms only once and releases the object URL', async () => {
  await mount()
  const useButton = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === 'Utiliser cette photo',
  )
  expect(useButton.disabled).toBe(true)
  await act(async () => images[0].onload())
  expect(useButton.disabled).toBe(false)
  await act(async () => {
    useButton.click()
    useButton.click()
  })
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(1)
  await act(async () =>
    blobCallback(new Blob(['encoded'], { type: 'image/webp' })),
  )
  expect(confirm).toHaveBeenCalledTimes(1)
  await act(async () => root.render(null))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
})
it('allows cancelling a failed image without confirming or uploading anything', async () => {
  await mount()
  await act(async () => images[0].onerror())
  expect(host.querySelector('[role="alert"]').textContent).toContain(
    'ne peut pas être lu',
  )
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Annuler')
      .click(),
  )
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(confirm).not.toHaveBeenCalled()
})
it('ignores an export that finishes after navigation away', async () => {
  await mount()
  await act(async () => images[0].onload())
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Utiliser cette photo')
      .click(),
  )
  await act(async () => root.render(null))
  await act(async () =>
    blobCallback(new Blob(['encoded'], { type: 'image/webp' })),
  )
  expect(confirm).not.toHaveBeenCalled()
})
