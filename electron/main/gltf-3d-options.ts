export type Convert3dPreset = 'optimize' | 'reserialize'

export interface Process3dOptions {
  preset?: Convert3dPreset
}

export interface SanitizedProcess3dOptions {
  preset: Convert3dPreset
}

export function sanitizeProcess3dOptions(raw: unknown): SanitizedProcess3dOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { preset: 'optimize' }
  }
  const p = (raw as Process3dOptions).preset
  if (p === 'reserialize') return { preset: 'reserialize' }
  return { preset: 'optimize' }
}
