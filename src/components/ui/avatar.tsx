import { forwardRef } from "react"

const Avatar = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className || ""}`}
    {...props}
  />
))
Avatar.displayName = "Avatar"

const AvatarImage = forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, ...props }, ref) => (
  <img
    ref={ref}
    className={`aspect-square h-full w-full ${className || ""}`}
    {...props}
  />
))
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex h-full w-full items-center justify-center rounded-full bg-muted ${className || ""}`}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }