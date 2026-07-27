import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Form element to render inside the modal body */
  children: React.ReactNode;
  /** Submit button label */
  submitLabel?: string;
  /** Whether the submit action is loading */
  submitting?: boolean;
  /** Click handler for the submit button */
  onSubmit?: (e: React.FormEvent) => void;
  /** Max width class — default "max-w-lg" */
  maxWidth?: string;
  /** Additional footer actions rendered before the submit button */
  extraFooter?: React.ReactNode;
}

export function ModalShell({
  open, onClose, title, children,
  submitLabel = "Save",
  submitting = false,
  onSubmit,
  maxWidth = "max-w-lg",
  extraFooter,
}: ModalShellProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-card border rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden max-h-[90vh] flex flex-col`}
          >
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="font-bold text-lg text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
              {children}
            </form>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-border/50 bg-muted/10">
              {extraFooter}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && (
                  <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
                  </svg>
                )}
                {submitLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
