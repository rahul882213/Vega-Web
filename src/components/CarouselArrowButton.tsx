import React from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';

interface CarouselArrowButtonProps {
  direction: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
  verticalCenterClass?: string;
}

export const CarouselArrowButton: React.FC<CarouselArrowButtonProps> = ({
  direction,
  visible,
  onClick,
  verticalCenterClass = 'top-[83px]',
}) => {
  if (!visible) return null;

  const isLeft = direction === 'left';

  return (
    <button
      type="button"
      aria-label={isLeft ? 'Scroll left' : 'Scroll right'}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center justify-center absolute ${
        isLeft ? 'left-1 sm:left-1.5' : 'right-1 sm:right-1.5'
      } ${verticalCenterClass} -translate-y-1/2 z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/75 hover:bg-black/90 text-white border border-white/15 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 opacity-85 md:opacity-0 md:group-hover/carousel:opacity-100 md:group-focus-within/carousel:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}>
      {isLeft ? (
        <ChevronLeft size={18} strokeWidth={2.4} />
      ) : (
        <ChevronRight size={18} strokeWidth={2.4} />
      )}
    </button>
  );
};
