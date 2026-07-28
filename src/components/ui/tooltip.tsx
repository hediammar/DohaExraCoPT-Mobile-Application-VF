import React, { forwardRef, createContext, useContext, useState } from "react"

const TooltipContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({
  open: false,
  setOpen: () => {}
})

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false)
  
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

const TooltipTrigger = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const { setOpen } = useContext(TooltipContext)
  
  const handleMouseEnter = () => setOpen(true)
  const handleMouseLeave = () => setOpen(false)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      ...(children.props as object)
    } as any)
  }
  
  return (
    <div
      ref={ref}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "right" | "bottom" | "left" }
>(({ className, children, side = "top", ...props }, ref) => {
  const { open } = useContext(TooltipContext)
  
  if (!open) return null
  
  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2"
  }
  
  const sideClass = sideClasses[side]
  
  return (
    <div
      ref={ref}
      className={`absolute z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 ${sideClass} ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }