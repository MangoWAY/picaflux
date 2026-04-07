import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { sanitizeImagePresetStored, type ImageProcessPresetRecord } from '../../src/lib/imagePreset'

const FILE_NAME = 'image-process-presets.json'
const MAX_PRESETS = 40
const MAX_NAME_LEN = 80

type StoreFile = {
  version: 1
  presets: ImageProcessPresetRecord[]
}

async function readStore(filePath: string): Promise<ImageProcessPresetRecord[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || !Array.isArray((j as StoreFile).presets)) {
      return []
    }
    const presets = (j as StoreFile).presets
    const out: ImageProcessPresetRecord[] = []
    for (const p of presets) {
      if (!p || typeof p !== 'object') continue
      const o = p as unknown as Record<string, unknown>
      const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const updatedAt =
        typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : 0
      if (!id || !name) continue
      out.push({
        id,
        name: name.slice(0, MAX_NAME_LEN),
        updatedAt,
        options: sanitizeImagePresetStored(o.options),
      })
    }
    return out
  } catch {
    return []
  }
}

async function writeStore(filePath: string, list: ImageProcessPresetRecord[]): Promise<void> {
  const payload: StoreFile = { version: 1, presets: list }
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload), 'utf8')
}

function storePath(userDataRoot: string): string {
  return path.join(userDataRoot, FILE_NAME)
}

export async function listImageProcessPresets(
  userDataRoot: string,
): Promise<ImageProcessPresetRecord[]> {
  const list = await readStore(storePath(userDataRoot))
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveImageProcessPreset(
  userDataRoot: string,
  name: string,
  options: unknown,
): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim().slice(0, MAX_NAME_LEN)
  if (!trimmed) {
    return { success: false, error: '预设名称不能为空' }
  }
  const sanitized = sanitizeImagePresetStored(options)
  const filePath = storePath(userDataRoot)
  let list = await readStore(filePath)
  if (list.length >= MAX_PRESETS) {
    list = [...list].sort((a, b) => a.updatedAt - b.updatedAt)
    list.shift()
  }
  const rec: ImageProcessPresetRecord = {
    id: randomUUID(),
    name: trimmed,
    updatedAt: Date.now(),
    options: sanitized,
  }
  list.push(rec)
  await writeStore(filePath, list)
  return { success: true }
}

export async function deleteImageProcessPreset(
  userDataRoot: string,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tid = typeof id === 'string' ? id.trim() : ''
  if (!tid) {
    return { success: false, error: '无效预设' }
  }
  const filePath = storePath(userDataRoot)
  const list = await readStore(filePath)
  const next = list.filter((p) => p.id !== tid)
  if (next.length === list.length) {
    return { success: false, error: '未找到该预设' }
  }
  await writeStore(filePath, next)
  return { success: true }
}
