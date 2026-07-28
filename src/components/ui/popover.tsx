import React, { createContext, useContext, useState, forwardRef } from "react"

interface PopoverContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const PopoverContext = createContext<PopoverContextType | undefined>(undefined)

const usePopoverContext = () => {
  const context = useContext(PopoverContext)
  if (!context) {
    throw new Error('Popover components must be used within a Popover')
  }
  return context
}

interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Popover = ({ open = false, onOpenChange = () => {}, children }: PopoverProps) => {
  return (
    <PopoverContext.Provider value={{ open, setOpen: onOpenChange }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const { open, setOpen } = usePopoverContext()

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
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  )
})
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    align?: "start" | "center" | "end"
    side?: "top" | "right" | "bottom" | "left"
  }
>(({ className, children, align = "center", side = "bottom", ...props }, ref) => {
  const { open, setOpen } = usePopoverContext()

  if (!open) return null

  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0"
  }

  const sideClasses = {
    top: "bottom-full mb-2",
    right: "left-full ml-2 top-0",
    bottom: "top-full mt-2",
    left: "right-full mr-2 top-0"
  }

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => setOpen(false)}
      />
      <div
        ref={ref}
        className={`absolute z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 ${sideClasses[side]} ${alignClasses[align]} ${className || ""}`}
        {...props}
      >
        {children}
      </div>
    </>
  )
})
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverContent, PopoverTrigger }