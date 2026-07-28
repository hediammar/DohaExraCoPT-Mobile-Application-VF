import { forwardRef } from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={`mx-auto flex w-full justify-center ${className || ""}`}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={`flex flex-row items-center gap-1 ${className || ""}`}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={className} {...props} />
))
PaginationItem.displayName = "PaginationItem"

interface PaginationLinkProps extends React.ComponentProps<"button"> {
  isActive?: boolean
}

const PaginationLink = forwardRef<HTMLButtonElement, PaginationLinkProps>(
  ({ className, isActive, ...props }, ref) => (
    <button
      ref={ref}
      aria-current={isActive ? "page" : undefined}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 ${
        isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
      } ${className || ""}`}
      {...props}
    />
  )
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof PaginationLink>
>(({ className, ...props }, ref) => (
  <PaginationLink
    ref={ref}
    aria-label="Go to previous page"
    className={`gap-1 pl-2.5 ${className || ""}`}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
))
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof PaginationLink>
>(({ className, ...props }, ref) => (
  <PaginationLink
    ref={ref}
    aria-label="Go to next page"
    className={`gap-1 pr-2.5 ${className || ""}`}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
))
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={`flex h-9 w-9 items-center justify-center ${className || ""}`}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}