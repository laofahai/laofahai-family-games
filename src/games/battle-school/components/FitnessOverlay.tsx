// 体测传感器挑战浮层：跳绳 / 仰卧起坐 / 坐位体前屈。
// 用手机 DeviceMotion(加速度) / DeviceOrientation(姿态) 计数；iOS 需在用户手势里请求权限。
// 没有传感器（桌面 / 不支持 / 拒权）→ 自动降级为「点按钮计数」。
//
// ESLint 合规：
//  · 不在 effect 里同步 setState 业务——计数发生在 window 的传感器**事件回调**里（允许）。
//  · 倒计时用 setInterval + cleanup（不在 effect 同步 setState；用 setState 更新剩余秒数是定时器回调，允许）。
//  · 传感器监听在 effect 里 add，cleanup 里 remove；用 ref 存可变累计值，事件回调里读写 ref（允许）。
//  · 组件用 key 重挂来「每次挑战重置」，无需在 effect 里 reset state。

import { useEffect, useRef, useState } from 'react'
import type { FitnessChallenge } from '../types'
import { Button } from '@/components/ui/button'

// iOS 13+：DeviceMotionEvent.requestPermission 是个静态方法（标准类型里没有，这里补声明）。
type PermissionRequestable = { requestPermission?: () => Promise<'granted' | 'denied'> }

function motionPermissionFn(): (() => Promise<'granted' | 'denied'>) | null {
  if (typeof window === 'undefined') return null
  const dme = (window as unknown as { DeviceMotionEvent?: PermissionRequestable }).DeviceMotionEvent
  return typeof dme?.requestPermission === 'function' ? dme.requestPermission.bind(dme) : null
}

// iOS 13+：DeviceOrientationEvent.requestPermission 是另一项独立权限（坐位体前屈用 orientation 必须单独申请）。
function orientationPermissionFn(): (() => Promise<'granted' | 'denied'>) | null {
  if (typeof window === 'undefined') return null
  const doe = (window as unknown as { DeviceOrientationEvent?: PermissionRequestable }).DeviceOrientationEvent
  return typeof doe?.requestPermission === 'function' ? doe.requestPermission.bind(doe) : null
}

function hasMotionApi(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
}
function hasOrientationApi(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

type Stage = 'intro' | 'running' | 'done'

export function FitnessOverlay({
  challenge,
  locked,
  onDone,
}: {
  challenge: FitnessChallenge
  locked: boolean
  onDone: (passed: boolean, reps: number) => void
}) {
  const [stage, setStage] = useState<Stage>('intro')
  const [reps, setReps] = useState(0)
  const [left, setLeft] = useState(challenge.durationSec)
  const [usingSensor, setUsingSensor] = useState(false)
  const [hint, setHint] = useState('')

  // 可变累计值放 ref，事件回调里读写（不触发渲染，达标/计数时才 setState 反映）
  const repsRef = useRef(0)
  const shownRepsRef = useRef(0) // 已反映到 state 的整数计数（避免 sitreach 闭包读 stale reps）
  const lastPeakAtRef = useRef(0) // 防抖：两次计数最小间隔
  const armedRef = useRef(true) // 跳绳/仰卧起坐：必须先「落下/躺下」才算下一个
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const bump = (now: number, minGap: number) => {
    if (now - lastPeakAtRef.current < minGap) return
    lastPeakAtRef.current = now
    repsRef.current += 1
    shownRepsRef.current = repsRef.current
    setReps(repsRef.current)
  }

  // 倒计时（只在 running 阶段跑）。到 0 自动结算。
  useEffect(() => {
    if (stage !== 'running') return
    let remaining = challenge.durationSec
    const id = window.setInterval(() => {
      remaining -= 1
      setLeft(remaining)
      if (remaining <= 0) {
        window.clearInterval(id)
        finish()
      }
    }, 1000)
    return () => window.clearInterval(id)
    // finish 用 ref 读最新 reps，依赖只需 stage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // 传感器监听（只在 running 且 usingSensor 时挂）
  useEffect(() => {
    if (stage !== 'running' || !usingSensor) return

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity ?? e.acceleration
      if (!a) return
      const now = e.timeStamp || performance.now()
      if (challenge.sport === 'rope') {
        // 跳绳：竖直加速度的上冲峰值计一次（含重力 ~9.8，腾空/落地会明显抖动）
        const vert = Math.abs(a.y ?? 0)
        if (vert > 16 && armedRef.current) {
          armedRef.current = false
          bump(now, 220)
        } else if (vert < 11) {
          armedRef.current = true
        }
      } else if (challenge.sport === 'situp') {
        // 仰卧起坐：用合加速度的起伏，一起一躺算一个
        const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
        if (mag > 15 && armedRef.current) {
          armedRef.current = false
          bump(now, 500)
        } else if (mag < 11) {
          armedRef.current = true
        }
      }
    }

    const onOrient = (e: DeviceOrientationEvent) => {
      if (challenge.sport !== 'sitreach') return
      // 坐位体前屈：手机贴在手上前屈，beta（前后倾角）越大越「够得到」。
      // 这里把 target 当作「保持前屈姿势的秒数」，beta 超过阈值时累计保持时长。
      const beta = e.beta ?? 0
      if (Math.abs(beta) > 45) {
        // 每次事件约 50Hz，攒满 1 秒（~50 次）记一秒；简单累加 ref，countdown 另算
        repsRef.current += 1 / 50
        const whole = Math.floor(repsRef.current)
        if (whole !== shownRepsRef.current) {
          shownRepsRef.current = whole
          setReps(whole)
        }
      }
    }

    if (challenge.sport === 'sitreach') {
      window.addEventListener('deviceorientation', onOrient)
    } else {
      window.addEventListener('devicemotion', onMotion)
    }
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      window.removeEventListener('deviceorientation', onOrient)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, usingSensor])

  function finish() {
    setStage('done')
    const got = Math.floor(repsRef.current)
    const passed = got >= challenge.target
    onDoneRef.current(passed, got)
  }

  async function startWithSensor() {
    // iOS 需在用户手势里请求权限。坐位体前屈用 DeviceOrientation（独立权限），其余用 DeviceMotion。
    const reqFn = challenge.sport === 'sitreach' ? orientationPermissionFn() : motionPermissionFn()
    if (reqFn) {
      try {
        const res = await reqFn()
        if (res !== 'granted') {
          setHint('没拿到传感器权限，改用点按钮计数～')
          startTapMode()
          return
        }
      } catch {
        setHint('请求权限出错，改用点按钮计数～')
        startTapMode()
        return
      }
    }
    const ok = challenge.sport === 'sitreach' ? hasOrientationApi() : hasMotionApi()
    if (!ok) {
      setHint('这台设备没有运动传感器，改用点按钮计数～')
      startTapMode()
      return
    }
    repsRef.current = 0
    shownRepsRef.current = 0
    armedRef.current = true
    lastPeakAtRef.current = 0
    setReps(0)
    setLeft(challenge.durationSec)
    setUsingSensor(true)
    setStage('running')
  }

  function startTapMode() {
    repsRef.current = 0
    shownRepsRef.current = 0
    setReps(0)
    setLeft(challenge.durationSec)
    setUsingSensor(false)
    setStage('running')
  }

  function tap() {
    if (stage !== 'running' || usingSensor) return
    repsRef.current += 1
    setReps(repsRef.current)
  }

  const progressPct = Math.min(100, Math.round((reps / Math.max(1, challenge.target)) * 100))
  const unitLabel = challenge.sport === 'sitreach' ? '秒' : challenge.unit

  return (
    <div className="bs-pop pointer-events-auto w-full max-w-xl rounded-3xl border border-ink-100 bg-white/95 p-4 text-center shadow-lg backdrop-blur sm:p-5">
      <div className="mb-1 flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-700">
          🏃 体测挑战
        </span>
      </div>

      <div className="text-4xl">{challenge.emoji}</div>
      <h3 className="mt-1 text-xl font-bold text-ink-900">{challenge.name}</h3>

      {stage === 'intro' && (
        <>
          <p className="mt-1 text-sm text-ink-600">
            {challenge.durationSec} 秒内做满 <b>{challenge.target}</b>
            {unitLabel}！达标直接放倒同学（大伤害），没达标自己掉点血。
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {challenge.sport === 'rope' && '握紧手机原地跳，传感器数你跳了几下～'}
            {challenge.sport === 'situp' && '手机贴在胸口/肚子上做起坐，数你起卧几次～'}
            {challenge.sport === 'sitreach' && '手机拿手上向前屈体保持，姿势够到就计时～'}
          </p>
          {hint && <p className="mt-2 text-xs text-rose-500">{hint}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              onClick={startWithSensor}
              disabled={locked}
              className="min-h-12 bg-lime-600 text-white hover:bg-lime-700"
            >
              开始（用手机感应）📱
            </Button>
            <Button onClick={startTapMode} disabled={locked} variant="outline" className="min-h-12">
              不方便动？点按钮计数 👆
            </Button>
          </div>
        </>
      )}

      {stage === 'running' && (
        <>
          <div className="mt-3 flex items-center justify-center gap-6">
            <div>
              <div className="text-4xl font-extrabold tabular-nums text-lime-700">{reps}</div>
              <div className="text-xs text-ink-500">/ {challenge.target}{unitLabel}</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold tabular-nums text-ink-800">{Math.max(0, left)}</div>
              <div className="text-xs text-ink-500">剩余秒</div>
            </div>
          </div>
          <div className="mx-auto mt-3 h-3 w-full max-w-sm overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-lime-500 transition-[width] duration-200" style={{ width: `${progressPct}%` }} />
          </div>
          {usingSensor ? (
            <p className="mt-3 text-sm text-ink-500">
              {challenge.sport === 'sitreach' ? '保持前屈姿势！' : '加油动起来！传感器在数～'}
            </p>
          ) : (
            <Button onClick={tap} className="mt-3 min-h-14 w-full bg-lime-600 text-white hover:bg-lime-700">
              用力点！+1 👆
            </Button>
          )}
          <Button onClick={finish} variant="ghost" className="mt-2 text-ink-400">
            提前结束
          </Button>
        </>
      )}
    </div>
  )
}
