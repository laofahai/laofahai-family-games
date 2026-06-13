import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BadgeCheck, Brain, CheckCircle2, Coins, HelpCircle, LineChart, Play, RotateCcw, Store, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { GrowthReport } from '@/platform/GrowthReport'
import { getMistakeQuestions, hydrateLearn, recordSession } from '@/platform/learning'
import { buildQuestions } from './data/questions'
import type { AnswerRecord, TownMode, TownQuestion } from './types'

interface ShiliuTownGameProps {
  onExit: () => void
}

type Stage = 'setup' | 'playing' | 'result'
type RoundStep = 'clues' | 'operation' | 'answer'

interface State {
  stage: Stage
  mode: TownMode
  count: number
  questions: TownQuestion[]
  index: number
  step: RoundStep
  selectedClues: Set<string>
  selectedOperation?: string
  selectedAnswer?: string
  checked: boolean
  lastCorrect?: boolean
  records: AnswerRecord[]
}

type Action =
  | { type: 'SET_MODE'; value: TownMode }
  | { type: 'SET_COUNT'; value: number }
  | { type: 'START'; questions: TownQuestion[] }
  | { type: 'TOGGLE_CLUE'; value: string }
  | { type: 'CHECK_CLUES' }
  | { type: 'SELECT_OPERATION'; value: string }
  | { type: 'SELECT_ANSWER'; value: string }
  | { type: 'NEXT' }
  | { type: 'RESET' }

const MODE_META: Record<TownMode, { label: string; desc: string; icon: string }> = {
  detective: { label: '小侦探读题', desc: '先找关键信息，再选算式', icon: '🕵️' },
  shop: { label: '购物小掌柜', desc: '认识钱数、总价、找零、够不够', icon: '🛒' },
  vertical: { label: '竖式挑战', desc: '个位十位对齐，进位借位不慌', icon: '🧮' },
  mixed: { label: '混合闯关', desc: '读题和购物轮流来', icon: '🎲' },
}

const COUNT_OPTIONS = [5, 8, 12]

const KIND_LABEL = {
  detective: '小侦探读题',
  shop: '购物小掌柜',
  spark: '轻松一下',
  vertical: '竖式挑战',
}

function sameSet(a: Set<string>, b: string[]): boolean {
  return a.size === b.length && b.every((id) => a.has(id))
}

function isAnswerCorrect(question: TownQuestion, answer?: string): boolean {
  return answer === question.answer
}

function recordEnergy(record: AnswerRecord): number {
  let energy = record.answerCorrect ? 2 : 0
  if (record.clueCorrect) energy += 1
  if (record.operationCorrect) energy += 1
  return energy
}

function rewardTitle(energy: number): string {
  if (energy >= 28) return '小镇掌柜王'
  if (energy >= 20) return '读题小侦探'
  if (energy >= 12) return '竖式稳定员'
  if (energy >= 6) return '认真闯关者'
  return '热身挑战者'
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
        step: action.questions[0]?.kind === 'detective' ? 'clues' : 'answer',
        selectedClues: new Set(),
        selectedOperation: undefined,
        selectedAnswer: undefined,
        checked: false,
        lastCorrect: undefined,
        records: [],
      }
    case 'TOGGLE_CLUE': {
      const next = new Set(state.selectedClues)
      if (next.has(action.value)) next.delete(action.value)
      else next.add(action.value)
      return { ...state, selectedClues: next }
    }
    case 'CHECK_CLUES': {
      const question = state.questions[state.index]
      if (question.kind !== 'detective') return state
      return {
        ...state,
        checked: true,
        lastCorrect: sameSet(state.selectedClues, question.correctClueIds),
      }
    }
    case 'SELECT_OPERATION': {
      const question = state.questions[state.index]
      if (question.kind !== 'detective') return state
      return {
        ...state,
        selectedOperation: action.value,
        checked: true,
        lastCorrect: action.value === question.operationAnswer,
      }
    }
    case 'SELECT_ANSWER': {
      const question = state.questions[state.index]
      return {
        ...state,
        selectedAnswer: action.value,
        checked: true,
        lastCorrect: isAnswerCorrect(question, action.value),
      }
    }
    case 'NEXT': {
      const question = state.questions[state.index]

      if (question.kind === 'detective' && state.step === 'clues') {
        return { ...state, step: 'operation', checked: false, lastCorrect: undefined }
      }

      if (question.kind === 'detective' && state.step === 'operation') {
        return { ...state, step: 'answer', checked: false, lastCorrect: undefined }
      }

      const record: AnswerRecord =
        question.kind === 'detective'
          ? {
              question,
              clueCorrect: sameSet(state.selectedClues, question.correctClueIds),
              operationCorrect: state.selectedOperation === question.operationAnswer,
              answerCorrect: isAnswerCorrect(question, state.selectedAnswer),
              your: state.selectedAnswer,
            }
          : {
              question,
              answerCorrect: isAnswerCorrect(question, state.selectedAnswer),
              your: state.selectedAnswer,
            }

      const nextIndex = state.index + 1
      const done = nextIndex >= state.questions.length
      const nextQuestion = state.questions[nextIndex]
      return {
        ...state,
        stage: done ? 'result' : 'playing',
        index: nextIndex,
        step: nextQuestion?.kind === 'detective' ? 'clues' : 'answer',
        selectedClues: new Set(),
        selectedOperation: undefined,
        selectedAnswer: undefined,
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

export function ShiliuTownGame({ onExit }: ShiliuTownGameProps) {
  const [state, dispatch] = useReducer(reducer, {
    stage: 'setup',
    mode: 'mixed',
    count: 8,
    questions: [],
    index: 0,
    step: 'answer',
    selectedClues: new Set<string>(),
    checked: false,
    records: [],
  })
  const [showHint, setShowHint] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const recordedRef = useRef(false)

  // 进场先把云端学习数据拉回来（没连码是无操作）
  useEffect(() => {
    void hydrateLearn('shiliu')
  }, [])

  // 一局结束记进学习库（错题进错题本、对的清掉）；「轻松一下」spark 卡不计分不入库。
  useEffect(() => {
    if (state.stage === 'result' && !recordedRef.current) {
      recordedRef.current = true
      recordSession(
        'shiliu',
        state.records
          .filter((r) => r.question.kind !== 'spark')
          .map((r) => ({ question: r.question, correct: r.answerCorrect, your: r.your }))
      )
    }
    if (state.stage !== 'result') recordedRef.current = false
  }, [state.stage, state.records])

  const startRedo = () => {
    const qs = getMistakeQuestions<TownQuestion>('shiliu')
    if (qs.length === 0) return
    setShowReport(false)
    setShowHint(false)
    dispatch({ type: 'START', questions: qs })
  }

  const question = state.questions[state.index]
  const progress = state.questions.length ? ((state.index + 1) / state.questions.length) * 100 : 0
  const correctCount = useMemo(
    () => state.records.filter((record) => record.answerCorrect).length,
    [state.records]
  )
  const energy = useMemo(() => state.records.reduce((sum, record) => sum + recordEnergy(record), 0), [
    state.records,
  ])

  if (state.stage === 'setup') {
    return (
      <>
      {showReport && (
        <GrowthReport game="shiliu" onClose={() => setShowReport(false)} onRedo={startRedo} />
      )}
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Store className="h-5 w-5 text-melon-600" />
            闫顺儿小镇
          </CardTitle>
          <CardDescription>先玩两个小店铺：读题破案和购物算钱。题目会换场景、换数字，也会换角色。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            {(Object.keys(MODE_META) as TownMode[]).map((mode) => {
              const meta = MODE_META[mode]
              const active = state.mode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_MODE', value: mode })}
                  className={cn(
                    'min-h-[118px] rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-melon-500 bg-melon-50 shadow'
                      : 'border-ink-200 bg-white hover:border-melon-300'
                  )}
                >
                  <div className="text-3xl">{meta.icon}</div>
                  <div className="mt-2 font-display text-xl text-ink-900">{meta.label}</div>
                  <div className="mt-1 text-xs text-ink-500">{meta.desc}</div>
                </button>
              )
            })}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-ink-700">今天玩几题？</div>
            <div className="grid grid-cols-3 gap-2">
              {COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_COUNT', value: count })}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-semibold transition',
                    state.count === count
                      ? 'border-ink-800 bg-ink-800 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {count} 题
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 text-sm text-ink-600 md:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 bg-white/80 p-4">
              <div className="flex items-center gap-2 font-semibold text-ink-900">
                <Brain className="h-4 w-4 text-melon-600" />
                先读懂
              </div>
              <p className="mt-1 text-xs">朱老师、陈老师、班长、店主、家人等视角都会出现，练真正读懂题。</p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-white/80 p-4">
              <div className="flex items-center gap-2 font-semibold text-ink-900">
                <Coins className="h-4 w-4 text-melon-600" />
                再算钱
              </div>
              <p className="mt-1 text-xs">可以当顾客，也可以当老板，反复练总价、找零、够不够、贵几元。</p>
            </div>
          </div>
          <div className="rounded-2xl border border-melon-200 bg-melon-50 p-4 text-sm text-melon-900">
            答对、找准线索、选对算式都会得到小镇能量，结束后解锁本局称号。
          </div>
        </CardContent>
        <div className="flex flex-col gap-2 px-6 pb-6">
          <Button
            onClick={() => {
              setShowHint(false)
              dispatch({ type: 'START', questions: buildQuestions(state.mode, state.count) })
            }}
            className="h-14 w-full gap-2 text-base"
          >
            <Play className="h-5 w-5" />
            进小镇
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
    const clueMiss = state.records.filter((r) => r.clueCorrect === false).length
    const operationMiss = state.records.filter((r) => r.operationCorrect === false).length
    const answerMiss = state.records.filter((r) => !r.answerCorrect).length
    return (
      <>
      {showReport && (
        <GrowthReport game="shiliu" onClose={() => setShowReport(false)} onRedo={startRedo} />
      )}
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BadgeCheck className="h-5 w-5 text-melon-600" />
            {rewardTitle(energy)}
          </CardTitle>
          <CardDescription>
            答对 {correctCount} / {state.records.length} 题，得到 {energy} 点小镇能量。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <ResultBox label="小镇能量" value={`${energy} 点`} />
            <ResultBox label="读题线索" value={clueMiss ? `漏了 ${clueMiss} 次` : '很稳'} />
            <ResultBox label="选择算式" value={operationMiss ? `错了 ${operationMiss} 次` : '很稳'} />
            <ResultBox label="最后答案" value={answerMiss ? `错了 ${answerMiss} 次` : '很稳'} />
          </div>
          <div className="space-y-2">
            {state.records.map((record, idx) => (
              <div key={record.question.id} className="rounded-2xl border border-ink-100 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink-900">
                    {idx + 1}. {record.question.title}
                  </div>
                  {record.answerCorrect ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-500">{record.question.explanation}</p>
              </div>
            ))}
          </div>
        </CardContent>
        <div className="flex flex-col gap-2 px-6 pb-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => dispatch({ type: 'START', questions: buildQuestions(state.mode, state.count) })}
              className="min-h-14 w-full shrink-0 gap-2 text-base sm:flex-1"
            >
              <RotateCcw className="h-4 w-4" />
              再来一局
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'RESET' })}
              className="min-h-14 w-full shrink-0 text-base sm:flex-1"
            >
              换模式
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

  return (
    <Card className="paper-grid overflow-hidden">
      <div className="h-2 bg-ink-100">
        <div className="h-full bg-melon-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-600 shadow-sm">
            第 {state.index + 1} / {state.questions.length} 题
          </span>
          <span className="rounded-full bg-melon-100 px-3 py-1 text-xs font-semibold text-melon-700">
            {KIND_LABEL[question.kind]}
          </span>
        </div>
        <CardTitle className="text-2xl">{question.title}</CardTitle>
        <CardDescription>{question.prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {question.kind === 'shop' && <ShopShelf question={question} />}
        {question.kind === 'vertical' && <VerticalBoard question={question} />}

        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="text-lg font-semibold leading-relaxed text-ink-900">
            {question.kind === 'shop' ? question.task : question.prompt}
          </div>
        </div>

        {question.kind === 'detective' && state.step === 'clues' && (
          <section className="space-y-3">
            <StepTitle title="圈出有用线索" sub="不用每个字都点，只点能帮忙算题的线索。" />
            <div className="grid gap-2 sm:grid-cols-2">
              {question.clues.map((clue) => {
                const active = state.selectedClues.has(clue.id)
                const shouldPick = question.correctClueIds.includes(clue.id)
                return (
                  <button
                    key={clue.id}
                    type="button"
                    onClick={() => !state.checked && dispatch({ type: 'TOGGLE_CLUE', value: clue.id })}
                    className={cn(
                      'rounded-2xl border p-4 text-left text-sm font-semibold transition',
                      active ? 'border-melon-500 bg-melon-50' : 'border-ink-200 bg-white',
                      state.checked && shouldPick && 'border-emerald-500 bg-emerald-50',
                      state.checked && active && !shouldPick && 'border-rose-400 bg-rose-50'
                    )}
                  >
                    {clue.text}
                  </button>
                )
              })}
            </div>
            <Feedback
              checked={state.checked}
              correct={state.lastCorrect}
              success="线索抓得准，小镇能量 +1。"
              fail={`再看一眼：${question.hint}`}
            />
            <ActionRow
              checked={state.checked}
              canCheck={state.selectedClues.size > 0}
              onCheck={() => dispatch({ type: 'CHECK_CLUES' })}
              onNext={() => {
                setShowHint(false)
                dispatch({ type: 'NEXT' })
              }}
              checkText="检查线索"
            />
          </section>
        )}

        {question.kind === 'detective' && state.step === 'operation' && (
          <section className="space-y-3">
            <StepTitle title="选一个算式" sub="先想数量是变多、变少，还是在比较。" />
            <ChoiceGrid
              choices={question.operationChoices}
              selected={state.selectedOperation}
              checked={state.checked}
              answer={question.operationAnswer}
              onSelect={(id) => dispatch({ type: 'SELECT_OPERATION', value: id })}
            />
            <Feedback
              checked={state.checked}
              correct={state.lastCorrect}
              success="算式方向对了，小镇能量 +1。"
              fail={question.hint}
            />
            <NextButton disabled={!state.checked} onClick={() => dispatch({ type: 'NEXT' })} />
          </section>
        )}

        {(question.kind === 'shop' || state.step === 'answer') && (
          <section className="space-y-3">
            <StepTitle title={question.kind === 'shop' ? '算一算，选答案' : '最后答案'} sub="可以用手指、画圈、凑十，慢慢来。" />
            <ChoiceGrid
              choices={question.answerChoices}
              selected={state.selectedAnswer}
              checked={state.checked}
              answer={question.answer}
              onSelect={(id) => dispatch({ type: 'SELECT_ANSWER', value: id })}
            />
            <Feedback
              checked={state.checked}
              correct={state.lastCorrect}
              success="答对了，小镇能量 +2。"
              fail={question.explanation}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setShowHint((v) => !v)}
                className="min-h-14 w-full shrink-0 gap-2 text-base sm:flex-1"
              >
                <HelpCircle className="h-5 w-5 shrink-0" />
                看提示
              </Button>
              <NextButton
                disabled={!state.checked}
                onClick={() => {
                  setShowHint(false)
                  dispatch({ type: 'NEXT' })
                }}
              />
            </div>
            {showHint && (
              <div className="rounded-2xl border border-melon-200 bg-melon-50 p-4 text-sm text-melon-900">
                {question.hint}
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  )
}

function ShopShelf({ question }: { question: Extract<TownQuestion, { kind: 'shop' }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white/90 p-4 text-center">
        <div className="text-xs font-semibold text-ink-500">{question.budgetLabel ?? '闫顺儿有'}</div>
        <div className="mt-1 font-display text-3xl text-melon-600">{formatMoney(question.budget)}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {question.items.map((item) => (
          <div key={item.name} className="rounded-2xl border border-ink-100 bg-white/90 p-3">
            <div className="text-3xl">{item.emoji}</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">{item.name}</div>
            <div className="text-xs text-ink-500">{formatMoney(item.price)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatMoney(yuan: number): string {
  const jiao = Math.round(yuan * 10)
  const yuanPart = Math.floor(jiao / 10)
  const jiaoPart = jiao % 10
  if (jiaoPart === 0) return `${yuanPart}元`
  if (yuanPart === 0) return `${jiaoPart}角`
  return `${yuanPart}元${jiaoPart}角`
}

function VerticalBoard({ question }: { question: Extract<TownQuestion, { kind: 'vertical' }> }) {
  const width = Math.max(String(question.top).length, String(question.bottom).length) + 1
  const top = String(question.top).padStart(width, ' ')
  const bottom = `${question.operator}${String(question.bottom).padStart(width - 1, ' ')}`
  return (
    <div className="rounded-2xl border border-ink-200 bg-ink-900 p-5 text-white shadow-inner">
      <div className="mb-2 text-xs font-semibold text-ink-100">竖式板</div>
      <pre className="inline-block text-right font-mono text-4xl leading-tight tracking-normal">
        {`${top}\n${bottom}\n---`}
      </pre>
      <div className="mt-3 text-xs text-ink-100">个位对个位，十位对十位，再计算。</div>
    </div>
  )
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-ink-900">{title}</div>
      <div className="text-xs text-ink-500">{sub}</div>
    </div>
  )
}

function ChoiceGrid({
  choices,
  selected,
  checked,
  answer,
  onSelect,
}: {
  choices: { id: string; text: string }[]
  selected?: string
  checked: boolean
  answer: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {choices.map((choice) => {
        const active = selected === choice.id
        const correct = checked && choice.id === answer
        const wrong = checked && active && choice.id !== answer
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => !checked && onSelect(choice.id)}
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
  )
}

function Feedback({
  checked,
  correct,
  success,
  fail,
}: {
  checked: boolean
  correct?: boolean
  success: string
  fail: string
}) {
  if (!checked) return null
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 text-sm font-medium',
        correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
      )}
    >
      {correct ? success : fail}
    </div>
  )
}

function ActionRow({
  checked,
  canCheck,
  onCheck,
  onNext,
  checkText,
}: {
  checked: boolean
  canCheck: boolean
  onCheck: () => void
  onNext: () => void
  checkText: string
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {!checked && (
        <Button onClick={onCheck} disabled={!canCheck} className="min-h-14 w-full shrink-0 text-base sm:flex-1">
          {checkText}
        </Button>
      )}
      {checked && <NextButton onClick={onNext} />}
    </div>
  )
}

function NextButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={disabled} className="min-h-14 w-full shrink-0 text-base sm:flex-1">
      下一步
    </Button>
  )
}

function ResultBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 font-display text-2xl text-ink-900">{value}</div>
    </div>
  )
}
