import BaseButton from "@/components/common/button/BaseButton";

export default function BasePagination({
  page = 1,
  totalPages = 1,
  onPageChange,
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">

      <div className="type-body text-muted-foreground ">
        第 {page} / {totalPages} 頁
      </div>

      <div className="flex gap-2">

        <BaseButton
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一頁
        </BaseButton>

        <BaseButton
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一頁
        </BaseButton>

      </div>
      
    </div>
  );
}
