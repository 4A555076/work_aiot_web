const BaseLoading = ({ className = "" }) => {
  return (
    <div
      className={`flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 py-8 text-muted-foreground ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="type-body font-medium ">資料載入中</span>
      </div>
    </div>
  );
};

export default BaseLoading;
