import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-4 p-0 sm:max-w-[450px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-4 overflow-hidden",
    "rounded-xl border border-l-[4px] p-4 pr-10",
    "shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]",
    "backdrop-blur-xl",
    "transition-all duration-300 ease-out",
    "data-[swipe=cancel]:translate-x-0",
    "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:duration-150",
    "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-white/95 border-gray-200/80 border-l-blue-500 text-gray-900 dark:bg-gray-900/95 dark:border-gray-700/80 dark:border-l-blue-500 dark:text-gray-50",
        destructive:
          "bg-white/95 border-red-200/80 border-l-red-500 text-gray-900 dark:bg-gray-900/95 dark:border-red-800/80 dark:border-l-red-500 dark:text-gray-50",
        success:
          "bg-white/95 border-emerald-200/80 border-l-emerald-500 text-gray-900 dark:bg-gray-900/95 dark:border-emerald-800/80 dark:border-l-emerald-500 dark:text-gray-50",
        warning:
          "bg-white/95 border-amber-200/80 border-l-amber-500 text-gray-900 dark:bg-gray-900/95 dark:border-amber-800/80 dark:border-l-amber-500 dark:text-gray-50",
        info:
          "bg-white/95 border-blue-200/80 border-l-blue-500 text-gray-900 dark:bg-gray-900/95 dark:border-blue-800/80 dark:border-l-blue-500 dark:text-gray-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/* ── Icon config per variant ─────────────────────────────────── */
const variantIconConfig = {
  default: {
    Icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    color: "text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
  },
  destructive: {
    Icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/40",
    color: "text-red-600 dark:text-red-400",
    bar: "bg-red-500",
  },
  success: {
    Icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    color: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  warning: {
    Icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    color: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  info: {
    Icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    color: "text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
  },
} as const

type ToastVariant = keyof typeof variantIconConfig

/* ── Progress bar sub-component ─────────────────────────────── */
interface ProgressBarProps {
  duration: number
  variant: ToastVariant
  paused: boolean
}

function ProgressBar({ duration, variant, paused }: ProgressBarProps) {
  const config = variantIconConfig[variant] ?? variantIconConfig.default
  const [width, setWidth] = React.useState(100)
  const startTimeRef = React.useRef<number>(Date.now())
  const elapsed = React.useRef<number>(0)
  const rafRef = React.useRef<number | null>(null)

  const tick = React.useCallback(() => {
    const now = Date.now()
    elapsed.current += now - startTimeRef.current
    startTimeRef.current = now
    const pct = Math.max(0, 100 - (elapsed.current / duration) * 100)
    setWidth(pct)
    if (pct > 0) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [duration])

  React.useEffect(() => {
    if (paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    } else {
      startTimeRef.current = Date.now()
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [paused, tick])

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100 dark:bg-gray-800 rounded-b-xl overflow-hidden">
      <div
        className={cn("h-full transition-none", config.bar)}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

/* ── Main Toast ──────────────────────────────────────────────── */
type ToastExtraProps = {
  /** Auto-dismiss duration in ms. Defaults to 5000. Pass 0 to never auto-dismiss. */
  duration?: number
}

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> &
  ToastExtraProps

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant, duration = 5000, children, ...props }, ref) => {
  const [paused, setPaused] = React.useState(false)
  const v = (variant ?? "default") as ToastVariant
  const config = variantIconConfig[v] ?? variantIconConfig.default
  const { Icon } = config

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      duration={duration}
      onPause={() => setPaused(true)}
      onResume={() => setPaused(false)}
      {...props}
    >
      {/* Accent icon */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl",
          config.bg,
          variant === "success" && "animate-in zoom-in-50 duration-500 spring-bounce"
        )}
        aria-hidden="true"
      >
        <Icon className={cn("w-5 h-5", config.color)} strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5 max-h-[80vh] overflow-y-auto no-scrollbar">
        {children}
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <ProgressBar duration={duration} variant={v} paused={paused} />
      )}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

/* ── Action button ───────────────────────────────────────────── */
const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "mt-2 inline-flex h-7 items-center justify-center rounded-lg border border-current/20 bg-transparent px-3 text-xs font-medium",
      "transition-colors hover:bg-black/5 dark:hover:bg-white/5",
      "focus:outline-none focus:ring-2 focus:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

/* ── Close button ────────────────────────────────────────────── */
const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-lg p-1 transition-all duration-150",
      "text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-60 hover:opacity-100",
      "dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800",
      "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-300",
      className
    )}
    toast-close=""
    aria-label="Dismiss notification"
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

/* ── Title ───────────────────────────────────────────────────── */
const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-snug tracking-tight text-gray-900 dark:text-gray-50",
      className
    )}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

/* ── Description ─────────────────────────────────────────────── */
const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "mt-1 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300",
      className
    )}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
