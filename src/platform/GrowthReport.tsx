// 成长小报：给一个学习游戏（=一个孩子）看「练了多少、哪科强哪科弱、错题本」。
// 入口在游戏的开始页和结算页；错题重做按钮把错题原样回放。

import { useEffect, useState, type ReactNode } from 'react'
import { Award, Cloud, CloudOff, Flame, RotateCcw, Target, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  clearMistakes,
  clearLearnCode,
  connectLearn,
  getLearnCode,
  getReport,
  hydrateLearn,
  KID_NAME,
  type LearnGame,
  type Report,
} from '@/platform/learning'

interface GrowthReportProps {
  game: LearnGame
  onClose: () => void
  onRedo: () => void
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

function cheer(r: Report): string {
  if (r.totalDone === 0) return '还没练过题，先玩一局，小报就长出来啦！'
  if (r.streak >= 3) return `已经连续 ${r.streak} 天啦，坚持就是超能力！`
  if (r.accuracy >= 0.9) return '正确率超高，太稳了！试试更难的也没问题。'
  if (r.mistakes.length > 0) return '把错题本清一清，弱的那块就补上来了。'
  return '保持手感，每天一点点，进步看得见。'
}

export function GrowthReport({ game, onClose, onRedo }: GrowthReportProps) {
  const [report, setReport] = useState<Report>(() => getReport(game))
  const empty = report.totalDone === 0
  const refresh = () => setReport(getReport(game))

  // 打开小报时若连了云端码，先把云端最新拉回来再显示
  useEffect(() => {
    let alive = true
    void hydrateLearn(game).then((synced) => {
      if (alive && synced) setReport(getReport(game))
    })
    return () => {
      alive = false
    }
  }, [game])

  const handleClear = () => {
    clearMistakes(game)
    setReport(getReport(game))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-melon-500" />
            <h2 className="font-display text-xl text-ink-900">{report.kid} 的成长小报</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {empty ? (
            <p className="py-8 text-center text-sm text-ink-500">{cheer(report)}</p>
          ) : (
            <div className="space-y-5">
              {/* 三个大数字 */}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="累计做题" value={String(report.totalDone)} />
                <Stat label="总正确率" value={pct(report.accuracy)} />
                <Stat
                  label="连续天数"
                  value={`${report.streak}`}
                  icon={<Flame className="h-4 w-4 text-melon-500" />}
                />
              </div>

              {/* 各科掌握度 */}
              {report.subjects.length > 0 && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                    <Target className="h-4 w-4 text-ink-500" />
                    各项掌握度
                  </h3>
                  <div className="space-y-2.5">
                    {report.subjects.map((s) => (
                      <div key={s.subject}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-ink-700">
                            {s.label}
                            {s.weak && (
                              <span className="ml-1.5 rounded-full bg-melon-100 px-1.5 py-0.5 text-[10px] font-semibold text-melon-700">
                                多练这块
                              </span>
                            )}
                          </span>
                          <span className="text-ink-500">
                            {s.correct}/{s.done} · {pct(s.accuracy)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className={s.weak ? 'h-full rounded-full bg-melon-400' : 'h-full rounded-full bg-melon-500'}
                            style={{ width: pct(s.accuracy) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 错题本 */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-700">
                    错题本（{report.mistakes.length}）
                  </h3>
                  {report.mistakes.length > 0 && (
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      清空
                    </button>
                  )}
                </div>
                {report.mistakes.length === 0 ? (
                  <p className="rounded-2xl bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
                    错题本是空的，真棒！
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {report.mistakes.slice(0, 30).map((m) => {
                      const right = m.choices.find((c) => c.id === m.answer)
                      const yours = m.choices.find((c) => c.id === m.your)
                      return (
                        <li key={m.qid} className="rounded-2xl border border-ink-100 bg-white px-4 py-3">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-melon-600">
                            {m.label}
                          </div>
                          {m.scenario && <p className="text-xs text-ink-500">{m.scenario}</p>}
                          <p className="text-sm text-ink-800">{m.prompt}</p>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                            {yours && <span className="text-ink-400 line-through">你选：{yours.text}</span>}
                            <span className="font-medium text-emerald-600">正确：{right?.text ?? m.answer}</span>
                          </div>
                          {m.explanation && (
                            <p className="mt-1 text-xs text-ink-500">{m.explanation}</p>
                          )}
                        </li>
                      )
                    })}
                    {report.mistakes.length > 30 && (
                      <li className="py-1 text-center text-xs text-ink-400">
                        还有 {report.mistakes.length - 30} 道，做对就会从这里消失
                      </li>
                    )}
                  </ul>
                )}
              </section>
            </div>
          )}
          <SyncSection game={game} onSynced={refresh} />
        </div>

        {/* 底部：鼓励 + 错题重做 */}
        <div className="space-y-3 border-t border-ink-100 px-5 py-4">
          {!empty && <p className="text-center text-xs text-ink-500">{cheer(report)}</p>}
          {report.mistakes.length > 0 ? (
            <Button onClick={onRedo} className="w-full">
              <RotateCcw className="h-4 w-4" />
              错题重做（{report.mistakes.length} 道）
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full">
              知道啦
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function SyncSection({ game, onSynced }: { game: LearnGame; onSynced: () => void }) {
  const [code, setCode] = useState<string | null>(() => getLearnCode(game))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const kid = KID_NAME[game]

  const connect = async (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 6)
    if (v.length < 4) return
    setBusy(true)
    const ok = await connectLearn(game, v)
    setBusy(false)
    if (ok) {
      setCode(v)
      setInput('')
      onSynced()
    }
  }

  const disconnect = () => {
    clearLearnCode(game)
    setCode(null)
  }

  if (code) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <Cloud className="h-4 w-4" />
            <span>已连云端 · 码 {code}</span>
          </div>
          <button onClick={disconnect} className="text-xs text-ink-500 hover:text-ink-700">
            断开
          </button>
        </div>
        <p className="mt-1 text-xs text-emerald-700/80">
          {kid}的错题本和成长记录已跟着这个码走，换设备输入同一个码即可。
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
        <CloudOff className="h-4 w-4 text-ink-400" />
        云端同步（可选）
      </div>
      <p className="mt-1 text-xs text-ink-500">
        连一个 6 位码，{kid}的错题本和成长记录就能跟着 TA 换设备。换手机时输同一个码即可。
      </p>
      <div className="mt-2 flex gap-2">
        <input
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 位数字"
          className="h-10 w-32 rounded-full border border-ink-200 bg-white px-4 text-center text-sm tracking-widest text-ink-800 outline-none focus:border-melon-400"
        />
        <Button
          size="sm"
          disabled={busy || input.length < 4}
          onClick={() => connect(input)}
          className="h-10"
        >
          {busy ? '连接中…' : '连接'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => connect(String(100000 + Math.floor(Math.random() * 900000)))}
          className="h-10"
        >
          生成
        </Button>
      </div>
    </section>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-ink-50 px-2 py-3 text-center">
      <div className="flex items-center justify-center gap-1 font-display text-2xl text-ink-900">
        {icon}
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-500">{label}</div>
    </div>
  )
}
