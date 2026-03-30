/**
 * IMG.LY @imgly/background-removal-node（AGPL，商用需自行评估许可）。
 * 动态 import，避免未使用抠图时拉长主进程启动时间。
 */
import type { BackgroundRemovalContext, IBackgroundRemovalBackend } from '../types'

type ImglyConfig = {
  model?: 'small' | 'medium'
  progress?: (key: string, current: number, total: number) => void
  debug?: boolean
}

export class ImglyBackgroundRemovalBackend implements IBackgroundRemovalBackend {
  readonly id = 'imgly'
  readonly displayName = 'IMG.LY（@imgly/background-removal-node）'

  async removeFromFile(inputPath: string, ctx?: BackgroundRemovalContext): Promise<Buffer> {
    const mod = await import('@imgly/background-removal-node')
    const removeBackground = mod.removeBackground as (
      src: string,
      config?: ImglyConfig,
    ) => Promise<Blob>

    const config: ImglyConfig = {
      model: 'medium',
      progress:
        ctx?.onProgress &&
        ((key: string, current: number, total: number) => {
          ctx.onProgress?.({
            ratio: total > 0 ? current / total : 0,
            phase: key,
          })
        }),
    }

    const blob = await removeBackground(inputPath, config)
    const ab = await blob.arrayBuffer()
    return Buffer.from(ab)
  }
}
