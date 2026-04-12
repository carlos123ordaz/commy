import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
    '3xl': 'max-w-4xl',
    '4xl': 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full bg-white shadow-2xl animate-slide-up flex flex-col',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[92dvh] sm:max-h-[90vh]',
          sizes[size],
          className
        )}
      >
        {/* Drag handle - mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {title && (
          <div className={cn('flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100', headerClassName)}>
            <div className="min-w-0 flex-1 pr-4">{title}</div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5', contentClassName)}>{children}</div>
        {footer && (
          <div className={cn('flex-shrink-0 px-4 sm:px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-100 flex justify-end gap-3', footerClassName)}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
