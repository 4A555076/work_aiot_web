const BaseError = ({
  message = "載入失敗，請刷新頁面重試",
  className = "",
}) => {
  return (
    <div
      className={`flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 py-8 px-4 ${className}`}
      role="alert"
    >
      <div className="rounded-xl border border-destructive/20 bg-card px-4 py-3 type-body font-medium text-destructive ">
        {message}
      </div>
    </div>
  );
};

export default BaseError;
