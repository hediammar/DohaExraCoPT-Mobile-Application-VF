import React, { createContext, useContext, useState, forwardRef } from "react"
import { X } from "lucide-react"

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

const useDialogContext = () => {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog')
  }
  return context
}

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Dialog = ({ open = false, onOpenChange = () => {}, children }: DialogProps) => {
  return (
    <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const { setOpen } = useDialogContext()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: () => setOpen(true),
      ...(children.props as Record<string, any>)
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
DialogTrigger.displayName = "DialogTrigger"

const DialogContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onOpenChange?: (open: boolean) => void }
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useDialogContext()

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
        className={`relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg md:w-full ${className || ""}`}
        {...props}
      >
        {children}
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col space-y-1.5 text-center sm:text-left ${className || ""}`}
    {...props}
  />
))
DialogHeader.displayName = "DialogHeader"

const DialogFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ""}`}
    {...props}
  />
))
DialogFooter.displayName = "DialogFooter"

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-lg font-semibold leading-none tracking-tight ${className || ""}`}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-muted-foreground ${className || ""}`}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}