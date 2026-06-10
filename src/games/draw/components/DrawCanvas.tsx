import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Trash2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Point {
  x: number
  y: number
}

interface Stroke {
  color: string
  width: number
  points: Point[]
}

const COLORS = ['#1f2937', '#e11d48', '#2563eb', '#16a34a', '#f59e0b'] as const
const ERASER_COLOR = '#ffffff'
const PEN_WIDTH = 5
const ERASER_WIDTH = 28

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.stroke()
}

export function DrawCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const [color, setColor] = useState<string>(COLORS[0])
  const [erasing, setErasing] = useState(false)
  const [strokeCount, setStrokeCount] = useState(0)

  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke)
    if (currentRef.current) drawStroke(ctx, currentRef.current)
  }, [])

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

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    currentRef.current = {
      color: erasing ? ERASER_COLOR : color,
      width: erasing ? ERASER_WIDTH : PEN_WIDTH,
      points: [pointFromEvent(e)],
    }
    repaint()
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!currentRef.current) return
    currentRef.current.points.push(pointFromEvent(e))
    repaint()
  }

  function handleUp() {
    if (!currentRef.current) return
    strokesRef.current = [...strokesRef.current, currentRef.current]
    currentRef.current = null
    repaint()
    setStrokeCount(strokesRef.current.length)
  }

  function undo() {
    strokesRef.current = strokesRef.current.slice(0, -1)
    repaint()
    setStrokeCount(strokesRef.current.length)
  }

  function clear() {
    strokesRef.current = []
    currentRef.current = null
    repaint()
    setStrokeCount(0)
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        className="h-[55vh] w-full touch-none rounded-3xl border border-ink-200 bg-white shadow-inner"
      />
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
            disabled={strokeCount === 0}
            className="flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
            撤销
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={strokeCount === 0}
            className="flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>
    </div>
  )
}
