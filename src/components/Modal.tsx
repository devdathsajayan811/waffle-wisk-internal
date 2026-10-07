import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portal to body: animated ancestors (transform) would otherwise trap position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-choco-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={`relative z-10 w-full ${widthClasses[maxWidth]} overflow-hidden rounded-t-3xl border border-cream-300/70 bg-white text-left shadow-soft-lg animate-scale-in sm:my-8 sm:rounded-2xl`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold leading-snug text-choco-900">{title}</h3>
              {description && <p className="mt-0.5 text-sm text-choco-400">{description}</p>}
            </div>
            <button onClick={onClose} className="icon-btn -mr-2 -mt-1 shrink-0" aria-label="Close dialog">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100dvh-160px)] overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
};
