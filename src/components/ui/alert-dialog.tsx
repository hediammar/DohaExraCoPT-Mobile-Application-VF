import React, { createContext, useContext, forwardRef } from "react"
import { X } from "lucide-react"

interface AlertDialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined)

const useAlertDialogContext = () => {
  const context = useContext(AlertDialogContext)
  if (!context) {
    throw new Error('AlertDialog components must be used within an AlertDialog')
  }
  return context
}

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const AlertDialog = ({ open = false, onOpenChange = () => {}, children }: AlertDialogProps) => {
  return (
    <AlertDialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

const AlertDialogTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: () => setOpen(true),
      ...(children.props || {})
    })
  }

  return (
    <button
      ref={ref}
      className={className}
      onClick={() => setOpen(true)}
      {...props}
    >
      {children}
    </button>
  )
})
AlertDialogTrigger.displayName = "AlertDialogTrigger"

const AlertDialogContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useAlertDialogContext()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0  backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      
      {/* Content */}
      <div
        ref={ref}
        className={`relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg ${className || ""}`}
        {...props}
      >
        {children}
      </div>
    </div>
  )
})
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col space-y-2 text-center sm:text-left ${className || ""}`}
    {...props}
  />
))
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ""}`}
    {...props}
  />
))
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={`text-lg font-semibold ${className || ""}`}
    {...props}
  />
))
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-muted-foreground ${className || ""}`}
    {...props}
  />
))
AlertDialogDescription.displayName = "AlertDialogDescription"

const AlertDialogAction = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()

  return (
    <button
      ref={ref}
      className={`inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className || ""}`}
      onClick={(e) => {
        props.onClick?.(e)
        setOpen(false)
      }}
      {...props}
    />
  )
})
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()

  return (
    <button
      ref={ref}
      className={`inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className || ""}`}
      onClick={(e) => {
        props.onClick?.(e)
        setOpen(false)
      }}
      {...props}
    />
  )
})
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
}