import { describe, it, expect, beforeAll } from 'vitest'
import { Document, NodeIO } from '@gltf-transform/core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  getModel3dFileInfo,
  processGlbConvert,
  save3dThumbnailPng,
} from '../electron/main/gltf-3d-processor'

/** 1×1 透明 PNG */
const TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let testGlbPath: string
let workDir: string

beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picaflux-3d-'))
  testGlbPath = path.join(workDir, 'triangle.glb')
  const io = new NodeIO()
  const doc = new Document()
  const buffer = doc.createBuffer()
  const position = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer)
  const indices = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer)
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices)
  const mesh = doc.createMesh().addPrimitive(prim)
  const node = doc.createNode().setMesh(mesh)
  doc.createScene().addChild(node)
  await io.write(testGlbPath, doc)
})

describe('gltf-3d-processor', () => {
  it('getModel3dFileInfo reads glb structure', async () => {
    const info = await getModel3dFileInfo(testGlbPath)
    expect(info).not.toBeNull()
    expect(info!.meshCount).toBeGreaterThanOrEqual(1)
    expect(info!.size).toBeGreaterThan(0)
  })

  it('processGlbConvert optimize writes optimized glb', async () => {
    const r = await processGlbConvert(testGlbPath, workDir, { preset: 'optimize' })
    expect(r.success).toBe(true)
    expect(r.outputPath).toMatch(/_optimized\.glb$/)
    if (r.outputPath) {
      const st = fs.statSync(r.outputPath)
      expect(st.size).toBeGreaterThan(100)
    }
  })

  it('processGlbConvert reserialize writes _out.glb', async () => {
    const r = await processGlbConvert(testGlbPath, workDir, { preset: 'reserialize' })
    expect(r.success).toBe(true)
    expect(r.outputPath).toMatch(/_out\.glb$/)
  })

  it('save3dThumbnailPng writes png', async () => {
    const r = await save3dThumbnailPng(testGlbPath, workDir, TINY_PNG_BASE64)
    expect(r.success).toBe(true)
    expect(r.outputPath).toMatch(/_thumb\.png$/)
    if (r.outputPath) {
      expect(fs.statSync(r.outputPath).size).toBeGreaterThan(50)
    }
  })

  it('rejects non-gltf extension', async () => {
    const bad = path.join(workDir, 'x.txt')
    fs.writeFileSync(bad, 'nope')
    const r = await processGlbConvert(bad, workDir, { preset: 'optimize' })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/Only \.glb/i)
  })
})
