import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface StudentRanker {
  id: number;
  image: string;
  name?: string;
  exam?: string;
  rank?: string;
}

const defaultStudents: StudentRanker[] = [
  { id: 1, image: '/students/student-1.avif', name: 'Ranker 1', exam: 'GATE / JEE' },
  { id: 2, image: '/students/student-2.avif', name: 'Ranker 2', exam: 'GATE / JEE' },
  { id: 3, image: '/students/student-3.avif', name: 'Ranker 3', exam: 'GATE / JEE' },
  { id: 4, image: '/students/student-4.avif', name: 'Ranker 4', exam: 'GATE / JEE' },
  { id: 5, image: '/students/student-5.avif', name: 'Ranker 5', exam: 'GATE / JEE' },
  { id: 6, image: '/students/student-6.avif', name: 'Ranker 6', exam: 'GATE / JEE' },
  { id: 7, image: '/students/student-7.avif', name: 'Ranker 7', exam: 'GATE / JEE' },
  { id: 8, image: '/students/student-8.avif', name: 'Ranker 8', exam: 'GATE / JEE' },
  { id: 9, image: '/students/student-9.avif', name: 'Ranker 9', exam: 'GATE / JEE' },
  { id: 10, image: '/students/student-10.avif', name: 'Ranker 10', exam: 'GATE / JEE' },
  { id: 11, image: '/students/student-11.avif', name: 'Ranker 11', exam: 'GATE / JEE' },
  { id: 12, image: '/students/student-12.avif', name: 'Ranker 12', exam: 'GATE / JEE' },
];

export default function StudentCarousel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      checkScroll();
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Continuous subtle auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        if (scrollLeft >= scrollWidth - clientWidth - 10) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollContainerRef.current.scrollBy({ left: 110, behavior: 'smooth' });
        }
      }
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-5xl mx-auto px-2 sm:px-6 my-4 select-none">
      {/* Left Chevron Button */}
      <button
        onClick={() => handleScroll('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll students left"
        className={`absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 border border-slate-200/90 shadow-sm flex items-center justify-center text-slate-400 hover:text-teal-700 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Horizontal Avatars Track */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar py-2 px-8 sm:px-10 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {defaultStudents.map((st) => (
          <div
            key={st.id}
            className="flex-shrink-0 group relative flex flex-col items-center"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full p-[2.5px] border-2 border-teal-500 bg-white shadow-xs group-hover:scale-108 group-hover:border-teal-600 group-hover:shadow-md transition-all duration-300">
              <img
                src={st.image}
                alt={`Abhiyantra Student ${st.id}`}
                className="w-full h-full rounded-full object-cover bg-slate-100"
                loading="lazy"
                onError={(e) => {
                  // Fallback if image path differs
                  (e.target as HTMLImageElement).src = '/logo.png';
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Right Chevron Button */}
      <button
        onClick={() => handleScroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll students right"
        className={`absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 border border-slate-200/90 shadow-sm flex items-center justify-center text-slate-400 hover:text-teal-700 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
