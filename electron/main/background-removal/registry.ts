import type {
  BackgroundRemovalBackendId,
  BackgroundRemovalBackendMeta,
  IBackgroundRemovalBackend,
} from './types'
import { ImglyBackgroundRemovalBackend } from './backends/imgly-backend'

const backends = new Map<BackgroundRemovalBackendId, IBackgroundRemovalBackend>()

/** 默认后端；无用户配置时使用 */
export const DEFAULT_BACKGROUND_REMOVAL_BACKEND_ID = 'imgly'

/**
 * 应用启动时调用一次，注册所有内置后端。
 * 后续新增后端：在此 new 并 register；或拆成插件时再挂接。
 */
export function registerBackgroundRemovalBackends(): void {
  backends.clear()
  registerBackend(new ImglyBackgroundRemovalBackend())
}

export function registerBackend(backend: IBackgroundRemovalBackend): void {
  backends.set(backend.id, backend)
}

export function getBackgroundRemovalBackend(
  id?: BackgroundRemovalBackendId,
): IBackgroundRemovalBackend {
  const resolved = id && backends.has(id) ? id : DEFAULT_BACKGROUND_REMOVAL_BACKEND_ID
  const backend = backends.get(resolved)
  if (!backend) {
    throw new Error(
      `Unknown background removal backend "${String(id)}". Registered: ${listBackgroundRemovalBackendIds().join(', ') || '(none)'}`,
    )
  }
  return backend
}

export function listBackgroundRemovalBackendMetas(): BackgroundRemovalBackendMeta[] {
  return [...backends.values()].map((b) => ({ id: b.id, displayName: b.displayName }))
}

function listBackgroundRemovalBackendIds(): string[] {
  return [...backends.keys()]
}
