import type { Encounter } from '@/games/_battle/encounters'
import { Button } from '@/components/ui/button'

export function EncounterOverlay({
  encounter,
  enemyEmoji,
  enemyName,
  locked,
  onPick,
}: {
  encounter: Encounter
  enemyEmoji: string
  enemyName: string
  locked: boolean
  onPick: (optionId: string) => void
}) {
  return (
    <div className="bs-pop pointer-events-auto w-full max-w-xl rounded-3xl border border-ink-100 bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          🫱 同学遭遇
        </span>
        <span className="text-sm font-medium text-ink-600">
          {enemyEmoji} {enemyName}
        </span>
      </div>

      <p className="mb-3 text-lg font-semibold leading-snug text-ink-900">{encounter.prompt}</p>

      <div className="flex flex-col gap-2">
        {encounter.options.map((o) => (
          <Button
            key={o.id}
            variant="outline"
            disabled={locked}
            onClick={() => onPick(o.id)}
            className="min-h-12 justify-start whitespace-normal py-2 text-left text-base"
          >
            {o.text}
          </Button>
        ))}
      </div>
    </div>
  )
}
