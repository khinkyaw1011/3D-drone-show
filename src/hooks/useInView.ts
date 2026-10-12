'use client';

import { type RefObject, useEffect, useState } from 'react';

/** Whether an element is on screen; used to stop rendering the show when it is scrolled away. */
export function useInView(ref: RefObject<Element | null>, threshold = 0.05): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return inView;
}
