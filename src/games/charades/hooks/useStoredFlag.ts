import { useEffect, useState } from 'react'

export function useStoredFlag(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return defaultValue
    const raw = localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
    return defaultValue
  })

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value ? '1' : '0')
  }, [key, value])

  return [value, setValue] as const
}
