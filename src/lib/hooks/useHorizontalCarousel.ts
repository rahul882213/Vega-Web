import React, {useCallback, useEffect, useRef, useState} from 'react';

export function useHorizontalCarousel(itemCount: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextLeft = el.scrollLeft > 2;
    const nextRight = maxScroll > 2 && el.scrollLeft < maxScroll - 2;
    setCanScrollLeft(prev => (prev === nextLeft ? prev : nextLeft));
    setCanScrollRight(prev => (prev === nextRight ? prev : nextRight));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    updateScrollState();
    const rafId = window.requestAnimationFrame(updateScrollState);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateScrollState();
      });
      observer.observe(el);
    }

    window.addEventListener('resize', updateScrollState);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [itemCount, updateScrollState]);

  const scrollByPage = useCallback((direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    const distance = Math.max(Math.round(el.clientWidth * 0.8), 240);
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowLeft') {
        if (canScrollLeft) {
          e.preventDefault();
          scrollByPage('left');
        }
      } else if (e.key === 'ArrowRight') {
        if (canScrollRight) {
          e.preventDefault();
          scrollByPage('right');
        }
      }
    },
    [canScrollLeft, canScrollRight, scrollByPage],
  );

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    updateScrollState,
    scrollByPage,
    handleKeyDown,
  };
}
