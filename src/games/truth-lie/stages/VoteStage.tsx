import { Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, StatementIndex } from '../types'
import { infoOf } from '../types'
import { cn } from '@/lib/utils'

interface VoteStageProps {
  teller: PlayerId
  voters: PlayerId[]
  votes: Partial<Record<PlayerId, StatementIndex>>
  onVote: (voter: PlayerId, index: StatementIndex) => void
  onReveal: () => void
}

const INDEXES: StatementIndex[] = [1, 2, 3]

export function VoteStage({ teller, voters, votes, onVote, onReveal }: VoteStageProps) {
  const tellerInfo = infoOf(teller)
  const allVoted = voters.every((v) => votes[v] !== undefined)

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Vote className="h-5 w-5 text-melon-600" />
          投票：哪件是编的？
        </CardTitle>
        <CardDescription>
          每人选一个号码——你觉得 {tellerInfo.name} 说的哪件事是假的？
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {voters.map((voter) => {
          const info = infoOf(voter)
          const picked = votes[voter]
          return (
            <div
              key={voter}
              className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100/70 bg-white/80 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{info.emoji}</span>
                <span className="text-sm font-semibold text-ink-900">{info.name}</span>
              </div>
              <div className="flex gap-2">
                {INDEXES.map((i) => {
                  const active = picked === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onVote(voter, i)}
                      className={cn(
                        'h-12 w-12 rounded-2xl border text-lg font-bold transition',
                        active
                          ? 'border-melon-500 bg-melon-500 text-white shadow'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-melon-300'
                      )}
                    >
                      {i}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {!allVoted && <div className="text-xs text-ink-500">所有人投完票才能揭晓。</div>}
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onReveal} disabled={!allVoted} className="h-14 w-full text-base">
          投票完毕，揭晓真相
        </Button>
      </div>
    </Card>
  )
}
