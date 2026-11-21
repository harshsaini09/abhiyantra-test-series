import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for a countdown timer.
 *
 * @param initialSeconds - Total seconds to count down from
 * @param onExpire       - Callback fired once when the timer reaches 0
 * @param isActive       - Whether the timer is currently ticking
 */
export function useTimer(
  initialSeconds: number,
  onExpire: () => void,
  isActive: boolean
) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep the callback ref up-to-date without restarting the interval
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Sync remaining seconds when initialSeconds changes (e.g. restoring state)
  useEffect(() => {
    setRemainingSeconds(initialSeconds);
    hasExpiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive) return;

    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            // Fire onExpire asynchronously to avoid state-update-during-render
            setTimeout(() => onExpireRef.current(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isActive]);

  const isWarning = remainingSeconds < 300; // less than 5 minutes

  return { remainingSeconds, isWarning } as const;
}
