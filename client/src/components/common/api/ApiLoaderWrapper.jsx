import BaseError from "@/components/common/api/BaseError";
import BaseLoading from "@/components/common/api/BaseLoading";
import { cn } from "@/lib/utils";


const BaseApiLoaderWrapper = ({
  isLoading,
  isError,
  children,
  className,
  CustomLoading = <BaseLoading />,
  CustomError = <BaseError />,
  classNameForAnimation,
}) => {
  return (
    <div
      aria-live="polite"
      key={isLoading ? "loading" : isError ? "error" : "ready"}
      className={className}
    >
      {isLoading ? (
        CustomLoading
      ) : isError ? (
        CustomError
      ) : (
        <div
          aria-busy="true"
          className={cn(
            "h-full",
            "opacity-0 translate-y-2 transition-all duration-500 ease-out",
            "aria-busy:opacity-100 aria-busy:translate-y-0",
            "motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
            classNameForAnimation
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default BaseApiLoaderWrapper;