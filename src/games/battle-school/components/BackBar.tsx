export function BackBar({ onExit }: { onExit: () => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={onExit}
        className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
      >
        ← 返回
      </button>
    </div>
  )
}
