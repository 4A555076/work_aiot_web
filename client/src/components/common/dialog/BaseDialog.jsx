import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import BaseButton from "@/components/common/button/BaseButton";

export default function BaseDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  onCancel,
  confirmVariant = "default",
  confirmText = "確認",
  cancelText = "取消",
  loading = false,
  confirmDisabled = false,
  hideFooter = false,
  className,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border-border p-5 shadow-[0_24px_80px_rgba(22,21,21,0.18)] sm:max-h-[85vh] sm:max-w-200 sm:p-6", className)}>
        
        {(title || description) && (
          <DialogHeader className="shrink-0">
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && (
              <DialogDescription>
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="flex-1 overflow-y-auto pr-2">{children}</div>

        {!hideFooter && (
          <DialogFooter className="gap-2 bg-card">
            <BaseButton
              variant="outline"
              onClick={onCancel || (() => onOpenChange(false))}
              disabled={loading}
            >
              {cancelText}
            </BaseButton>

            <BaseButton
              onClick={onConfirm}
              variant={confirmVariant}
              loading={loading}
              disabled={confirmDisabled || loading}
            >
              {confirmText}
            </BaseButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
