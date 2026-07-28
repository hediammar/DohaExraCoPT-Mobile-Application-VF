import React from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success' | 'info';
  className?: string;
}

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-background border-border',
      destructive: 'bg-destructive/15 text-destructive border-destructive/20',
      success: 'bg-green-50 text-green-800 border-green-200',
      info: 'bg-blue-50 text-blue-800 border-blue-200'
    };

    const iconMap = {
      default: AlertCircle,
      destructive: XCircle,
      success: CheckCircle,
      info: Info
    };

    const Icon = iconMap[variant];

    return (
      <div
        ref={ref}
        className={cn(
          'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <Icon className="h-4 w-4" />
        {children}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    >
      {children}
    </div>
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription }; 