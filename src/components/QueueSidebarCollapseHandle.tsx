import React from 'react'
import { ChevronLeft } from 'lucide-react'

/** 队列与主工作区之间的竖向分隔条上的「收起队列」控件 */
export function QueueSidebarCollapseHandle({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="flex h-full min-h-0 w-4 shrink-0 flex-col items-center justify-center border-l border-[#2d2d2d] bg-[#181818] hover:bg-[#1c1c1c]">
      <button
        type="button"
        onClick={onCollapse}
        className="rounded p-0.5 text-gray-500 transition-colors hover:bg-[#2d2d2d] hover:text-gray-200"
        aria-label="收起队列"
        title="收起队列"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  )
}
