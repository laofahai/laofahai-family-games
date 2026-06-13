import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  BadgeCheck,
  CheckCircle2,
  Compass,
  FolderSearch,
  HelpCircle,
  LineChart,
  Play,
  Rocket,
  RotateCcw,
  Shuffle,
  Sparkles,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { GrowthReport } from '@/platform/GrowthReport'
import { getMistakeQuestions, recordSession } from '@/platform/learning'
import { buildBureauQuestions } from './data/questions'
import type { BureauMode, BureauQuestion, BureauRecord } from './types'

interface YiyiBureauGameProps {
  onExit: () => void
}

type Stage = 'setup' | 'playing' | 'result'

interface State {
  stage: Stage
  mode: BureauMode
  count: number
  questions: BureauQuestion[]
  index: number
  selected?: string
  checked: boolean
  lastCorrect?: boolean
  records: BureauRecord[]
}

type Action =
  | { type: 'SET_MODE'; value: BureauMode }
  | { type: 'SET_COUNT'; value: number }
  | { type: 'START'; questions: BureauQuestion[] }
  | { type: 'SELECT'; value: string }
  | { type: 'NEXT' }
  | { type: 'RESET' }

const MODE_META: Record<BureauMode, { label: string; desc: string; icon: typeof Compass }> = {
  planner: { label: '城市策划师', desc: '预算、路线、统计、折扣、面积全是数学硬仗', icon: Compass },
  archive: { label: '任务档案室', desc: '读通知、抓重点、辨真假，中英文情报都要看懂', icon: FolderSearch },
  preview: { label: '初中预告站', desc: '负数、方程、文言、英文短文，提前探个路', icon: Rocket },
  mixed: { label: '混合任务局', desc: '数学为主，各科随机混搭，最像真实出勤', icon: Shuffle },
}

const COUNT_OPTIONS = [6, 10, 15]

// 答题后先停顿这么多秒看解析，再放开「下一个任务」
const REVIEW_SECONDS = 4

const KIND_TONE: Record<BureauQuestion['kind'], string> = {
  math: 'bg-melon-100 text-melon-700',
  chinese: 'bg-amber-100 text-amber-700',
  english: 'bg-sky-100 text-sky-700',
  science: 'bg-emerald-100 text-emerald-700',
  spark: 'bg-violet-100 text-violet-700',
}

function isSpark(q: BureauQuestion): boolean {
  return q.kind === 'spark'
}

function rankTitle(score: number, total: number): string {
  if (total === 0) return '任务局新人'
  const rate = score / total
  if (rate >= 0.9) return '任务局金牌主理人'
  if (rate >= 0.75) return '王牌策划官'
  if (rate >= 0.6) return '可靠的行动队长'
  if (rate >= 0.4) return '成长中的特派员'
  return '热身上岗的实习生'
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.value }
    case 'SET_COUNT':
      return { ...state, count: action.value }
    case 'START':
      return {
        ...state,
        stage: 'playing',
        questions: action.questions,
        index: 0,
        selected: undefined,
        checked: false,
        lastCorrect: undefined,
        records: [],
      }
    case 'SELECT': {
      const question = state.questions[state.index]
      return {
        ...state,
        selected: action.value,
        checked: true,
        lastCorrect: action.value === question.answer,
      }
    }
    case 'NEXT': {
      const question = state.questions[state.index]
      const record: BureauRecord = {
        question,
        correct: state.selected === question.answer,
        your: state.selected,
      }
      const nextIndex = state.index + 1
      const done = nextIndex >= state.questions.length
      return {
        ...state,
        stage: done ? 'result' : 'playing',
        index: nextIndex,
        selected: undefined,
        checked: false,
        lastCorrect: undefined,
        records: [...state.records, record],
      }
    }
    case 'RESET':
      return { ...state, stage: 'setup' }
    default:
      return state
  }
}

export function YiyiBureauGame({ onExit }: YiyiBureauGameProps) {
  const [state, dispatch] = useReducer(reducer, {
    stage: 'setup',
    mode: 'mixed',
    count: 10,
    questions: [],
    index: 0,
    checked: false,
    records: [],
  })
  const [showHint, setShowHint] = useState(false)
  const [review, setReview] = useState(0)
  const [showReport, setShowReport] = useState(false)
  const recordedRef = useRef(false)

  useEffect(() => {
    if (review <= 0) return
    const timer = setTimeout(() => setReview((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [review])

  // 一局结束时把成绩记进学习库（错题进错题本、对的清掉）；非答题（茶水间 spark）不计。
  useEffect(() => {
    if (state.stage === 'result' && !recordedRef.current) {
      recordedRef.current = true
      recordSession(
        'yiyi',
        state.records
          .filter((r) => !isSpark(r.question))
          .map((r) => ({ question: r.question, correct: r.correct, your: r.your }))
      )
    }
    if (state.stage !== 'result') recordedRef.current = false
  }, [state.stage, state.records])

  const startRedo = () => {
    const qs = getMistakeQuestions<BureauQuestion>('yiyi')
    if (qs.length === 0) return
    setShowReport(false)
    setShowHint(false)
    setReview(0)
    dispatch({ type: 'START', questions: qs })
  }

  const question = state.questions[state.index]
  const progress = state.questions.length ? ((state.index + 1) / state.questions.length) * 100 : 0
  const scored = useMemo(() => state.records.filter((r) => !isSpark(r.question)), [state.records])
  const correctCount = useMemo(() => scored.filter((r) => r.correct).length, [scored])

  if (state.stage === 'setup') {
    return (
      <>
      {showReport && (
        <GrowthReport game="yiyi" onClose={() => setShowReport(false)} onRedo={startRedo} />
      )}
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Compass className="h-5 w-5 text-melon-600" />
            闫一依任务局
          </CardTitle>
          <CardDescription>
            一依在这里当策划人、队长、店主和数据分析员。任务随机生成，每次开局都不一样，数学最多，语文英语轮番上，还会冒出一点科学和小情报。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(MODE_META) as BureauMode[]).map((mode) => {
              const meta = MODE_META[mode]
              const active = state.mode === mode
              const Icon = meta.icon
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_MODE', value: mode })}
                  className={cn(
                    'min-h-[112px] rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-melon-500 bg-melon-50 shadow'
                      : 'border-ink-200 bg-white hover:border-melon-300'
                  )}
                >
                  <Icon className="h-6 w-6 text-melon-600" />
                  <div className="mt-2 font-display text-xl text-ink-900">{meta.label}</div>
                  <div className="mt-1 text-xs text-ink-500">{meta.desc}</div>
                </button>
              )
            })}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-ink-700">这次接几个任务？</div>
            <div className="grid grid-cols-3 gap-2">
              {COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_COUNT', value: count })}
                  className={cn(
                    'min-h-14 rounded-2xl border text-sm font-semibold transition',
                    state.count === count
                      ? 'border-ink-800 bg-ink-800 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {count} 个
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-melon-200 bg-melon-50 p-4 text-sm text-melon-900">
            每答对一个任务积 1 点行动力，中途偶尔有「茶水间」小卡，放松一下不计分。结束后按完成度解锁本局头衔。
          </div>
        </CardContent>
        <div className="flex flex-col gap-2 px-6 pb-6">
          <Button
            onClick={() => {
              setShowHint(false)
              dispatch({ type: 'START', questions: buildBureauQuestions(state.mode, state.count) })
            }}
            className="min-h-14 w-full gap-2 text-base"
          >
            <Play className="h-5 w-5" />
            上岗接任务
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowReport(true)}
            className="min-h-12 w-full gap-2"
          >
            <LineChart className="h-4 w-4" />
            成长小报 · 错题本
          </Button>
        </div>
      </Card>
      </>
    )
  }

  if (state.stage === 'result') {
    return (
      <>
      {showReport && (
        <GrowthReport game="yiyi" onClose={() => setShowReport(false)} onRedo={startRedo} />
      )}
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BadgeCheck className="h-5 w-5 text-melon-600" />
            {rankTitle(correctCount, scored.length)}
          </CardTitle>
          <CardDescription>
            完成 {correctCount} / {scored.length} 个任务，积满 {correctCount} 点行动力。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.records.map((record, idx) => {
            const spark = isSpark(record.question)
            return (
              <div key={record.question.id} className="rounded-2xl border border-ink-100 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink-900">
                    {idx + 1}. {record.question.title}
                  </div>
                  {spark ? (
                    <Sparkles className="h-5 w-5 shrink-0 text-violet-500" />
                  ) : record.correct ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-500">{record.question.explanation}</p>
              </div>
            )
          })}
        </CardContent>
        <div className="flex flex-col gap-2 px-6 pb-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                setShowHint(false)
                dispatch({ type: 'START', questions: buildBureauQuestions(state.mode, state.count) })
              }}
              className="min-h-14 w-full shrink-0 gap-2 text-base sm:flex-1"
            >
              <RotateCcw className="h-4 w-4" />
              再接一批
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'RESET' })}
              className="min-h-14 w-full shrink-0 text-base sm:flex-1"
            >
              换玩法
            </Button>
            <Button variant="ghost" onClick={onExit} className="min-h-14 w-full shrink-0 text-base sm:flex-1">
              回首页
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => setShowReport(true)}
            className="min-h-12 w-full gap-2"
          >
            <LineChart className="h-4 w-4" />
            看成长小报 · 错题本
          </Button>
        </div>
      </Card>
      </>
    )
  }

  if (!question) return null

  const spark = isSpark(question)

  return (
    <Card className="paper-grid overflow-hidden">
      <div className="h-2 bg-ink-100">
        <div className="h-full bg-melon-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-600 shadow-sm">
            第 {state.index + 1} / {state.questions.length} 个
          </span>
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', KIND_TONE[question.kind])}>
            {question.badge}
          </span>
        </div>
        <CardTitle className="text-2xl">{question.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {question.scenario && (
          <div className="rounded-2xl border border-ink-100 bg-white/90 p-4 text-sm leading-relaxed text-ink-700 whitespace-pre-line">
            {question.scenario}
          </div>
        )}

        <div className="rounded-2xl border border-ink-100 bg-melon-50/60 p-4">
          <div className="text-lg font-semibold leading-relaxed text-ink-900 whitespace-pre-line">
            {question.prompt}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {question.choices.map((choice) => {
            const active = state.selected === choice.id
            const correct = state.checked && choice.id === question.answer
            const wrong = state.checked && active && choice.id !== question.answer
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => {
                  if (state.checked) return
                  dispatch({ type: 'SELECT', value: choice.id })
                  setReview(REVIEW_SECONDS)
                }}
                className={cn(
                  'min-h-14 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-ink-800 transition',
                  active && 'border-melon-500 bg-melon-50',
                  correct && 'border-emerald-500 bg-emerald-50 text-emerald-800',
                  wrong && 'border-rose-400 bg-rose-50 text-rose-700'
                )}
              >
                {choice.text}
              </button>
            )
          })}
        </div>

        {state.checked && (
          <div
            className={cn(
              'rounded-2xl border p-4 text-sm font-medium',
              spark
                ? 'border-violet-200 bg-violet-50 text-violet-800'
                : state.lastCorrect
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
            )}
          >
            {spark
              ? question.explanation
              : state.lastCorrect
                ? `漂亮，任务搞定！${question.explanation}`
                : question.explanation}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {!spark && (
            <Button
              variant="outline"
              onClick={() => setShowHint((v) => !v)}
              className="min-h-14 w-full shrink-0 gap-2 text-base sm:flex-1"
            >
              <HelpCircle className="h-5 w-5 shrink-0" />
              要点线索
            </Button>
          )}
          <Button
            onClick={() => {
              setShowHint(false)
              setReview(0)
              dispatch({ type: 'NEXT' })
            }}
            disabled={!state.checked || review > 0}
            className="min-h-14 w-full shrink-0 text-base sm:flex-1"
          >
            {review > 0
              ? `看一下解析… ${review}`
              : state.index + 1 >= state.questions.length
                ? '交差结算'
                : '下一个任务'}
          </Button>
        </div>

        {showHint && !spark && (
          <div className="rounded-2xl border border-melon-200 bg-melon-50 p-4 text-sm text-melon-900">
            {question.hint}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
