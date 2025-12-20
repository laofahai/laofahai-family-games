import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-ink-200 transition data-[state=checked]:bg-melon-500',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition data-[state=checked]:translate-x-6'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
