import React from 'react';
import { Label } from './label';
import { CustomCalendar } from './custom-calendar';

interface DateInputProps {
  id: string;
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function DateInput({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder = "Select date", 
  required = false,
  className = ""
}: DateInputProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <CustomCalendar
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  );
} 