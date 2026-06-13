// 可实时同步的画板：drawer 画 → onSend 广播；viewer 通过 ref.apply 渲染别人的笔触。
// 坐标用「归一化 0..1」存储，渲染时按本端画布尺寸缩放，所以不同屏幕大小也对得上。

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser, Trash2, Undo2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface NPoint {
  x: number
  y: number
}
export interface Stroke {
  id: string
  color: string
  width: number
  points: NPoint[]
}
export type DrawMsg = { t: 'stroke'; s: Stroke } | { t: 'remove'; id: string } | { t: 'clear' }

export interface RemoteCanvasHandle {
  apply: (msg: DrawMsg) => void
  reset: () => void
}

const COLORS = ['#1f2937', '#e11d48', '#2563eb', '#16a34a', '#f59e0b'] as const
const ERASER_COLOR = '#ffffff'
const PEN_WIDTH = 4
const ERASER_WIDTH = 26
const SEND_MS = 45

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  if (s.points.length === 0) return
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(s.points[0].x * w, s.points[0].y * h)
  for (const p of s.points.slice(1)) ctx.lineTo(p.x * w, p.y * h)
  ctx.stroke()
}

export const RemoteCanvas = forwardRef<RemoteCanvasHandle, { editable: boolean; onSend?: (msg: DrawMsg) => void }>(
  function RemoteCanvas({ editable, onSend }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const strokesRef = useRef<Map<string, Stroke>>(new Map())
    const currentRef = useRef<Stroke | null>(null)
    const lastSentRef = useRef(0)
    const seqRef = useRef(0)
    const [color, setColor] = useState<string>(COLORS[0])
    const [erasing, setErasing] = useState(false)
    const [count, setCount] = useState(0)

    const repaint = useCallback(() => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (const s of strokesRef.current.values()) drawStroke(ctx, s, w, h)
      if (currentRef.current) drawStroke(ctx, currentRef.current, w, h)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        apply: (msg) => {
          if (msg.t === 'clear') strokesRef.current.clear()
          else if (msg.t === 'remove') strokesRef.current.delete(msg.id)
          else strokesRef.current.set(msg.s.id, msg.s)
          repaint()
        },
        reset: () => {
          strokesRef.current.clear()
          currentRef.current = null
          setCount(0)
          repaint()
        },
      }),
      [repaint]
    )

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const resize = () => {
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
        repaint()
      }
      resize()
      const observer = new ResizeObserver(resize)
      observer.observe(canvas)
      return () => observer.disconnect()
    }, [repaint])

    function npoint(e: React.PointerEvent<HTMLCanvasElement>): NPoint {
      const rect = e.currentTarget.getBoundingClientRect()
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
    }

    function maybeSend(now: number, force: boolean) {
      if (!onSend || !currentRef.current) return
      if (!force && now - lastSentRef.current < SEND_MS) return
      lastSentRef.current = now
      onSend({ t: 'stroke', s: { ...currentRef.current, points: [...currentRef.current.points] } })
    }

    function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!editable) return
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* 某些环境/合成事件没有活动指针，忽略即可 */
      }
      seqRef.current += 1
      currentRef.current = {
        id: `s-${seqRef.current}`,
        color: erasing ? ERASER_COLOR : color,
        width: erasing ? ERASER_WIDTH : PEN_WIDTH,
        points: [npoint(e)],
      }
      repaint()
    }

    function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!editable || !currentRef.current) return
      currentRef.current.points.push(npoint(e))
      repaint()
      maybeSend(performance.now(), false)
    }

    function handleUp() {
      if (!editable || !currentRef.current) return
      const s = currentRef.current
      strokesRef.current.set(s.id, s)
      currentRef.current = null
      repaint()
      setCount(strokesRef.current.size)
      onSend?.({ t: 'stroke', s })
    }

    function undo() {
      const keys = [...strokesRef.current.keys()]
      const last = keys[keys.length - 1]
      if (!last) return
      strokesRef.current.delete(last)
      repaint()
      setCount(strokesRef.current.size)
      onSend?.({ t: 'remove', id: last })
    }

    function clearAll() {
      strokesRef.current.clear()
      currentRef.current = null
      repaint()
      setCount(0)
      onSend?.({ t: 'clear' })
    }

    return (
      <div className="space-y-3">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className={cn(
            // 固定 4:3 宽高比：所有设备画板形状一致，归一化坐标映射过去不会被拉伸变形
            'aspect-[4/3] w-full rounded-3xl border bg-white shadow-inner',
            editable ? 'touch-none border-melon-300' : 'pointer-events-none border-ink-200'
          )}
        />
        {editable && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`画笔颜色 ${c}`}
                  onClick={() => {
                    setColor(c)
                    setErasing(false)
                  }}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 transition',
                    !erasing && color === c ? 'scale-110 border-ink-700' : 'border-white shadow'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                type="button"
                aria-label="橡皮擦"
                onClick={() => setErasing(true)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white transition',
                  erasing ? 'scale-110 border-ink-700' : 'border-ink-200 shadow'
                )}
              >
                <Eraser className="h-4 w-4 text-ink-700" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={count === 0}
                className="flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
                撤销
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={count === 0}
                className="flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                清空
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
)
