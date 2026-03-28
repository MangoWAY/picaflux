/**
 * 抠图后端抽象：新增实现时实现 {@link IBackgroundRemovalBackend} 并在 registry 注册即可。
 * 渲染进程只通过 IPC 传 backendId，不依赖具体库。
 */

/** 注册表中的后端标识（例如 imgly、将来 onnx-local、coreml 等） */
export type BackgroundRemovalBackendId = string

export interface BackgroundRemovalProgress {
  /** 0–1，可选；用于首次下载模型等阶段 */
  ratio: number
  /** 实现方自定义阶段名，如 asset key */
  phase?: string
}

export interface BackgroundRemovalContext {
  onProgress?: (p: BackgroundRemovalProgress) => void
}

/**
 * 所有抠图后端必须满足的契约：输入本地文件路径，输出带透明通道的 PNG 字节（与 sharp 管线衔接）。
 */
export interface IBackgroundRemovalBackend {
  readonly id: BackgroundRemovalBackendId
  readonly displayName: string
  /**
   * 从磁盘文件移除背景，返回 PNG（RGBA）Buffer。
   * 不负责写盘；由上层 image-processor 用 sharp 继续做缩放/转码。
   */
  removeFromFile(inputPath: string, ctx?: BackgroundRemovalContext): Promise<Buffer>
}

export interface BackgroundRemovalBackendMeta {
  id: BackgroundRemovalBackendId
  displayName: string
}
