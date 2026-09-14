import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import BaseButton from "@/components/common/button/BaseButton";

export default function ScrollToTopButton({ scrollContainerRef }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return undefined;

    const updateVisibility = () => {
      setIsVisible(scrollContainer.scrollTop > 300);
    };

    updateVisibility();
    scrollContainer.addEventListener("scroll", updateVisibility, { passive: true });

    return () => scrollContainer.removeEventListener("scroll", updateVisibility);
  }, [scrollContainerRef]);

  const scrollToTop = () => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <BaseButton
      size="icon-lg"
      onClick={scrollToTop}
      aria-label="回到頁面頂端"
      title="回到頁面頂端"
      className={`absolute bottom-5 right-5 z-20 rounded-full shadow-lg sm:bottom-6 sm:right-6 ${
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp size={20} strokeWidth={2.5} aria-hidden="true" />
    </BaseButton>
  );
}
