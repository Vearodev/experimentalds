import { useEffect, useRef, useState } from 'react';
export type Scenario = 'success' | 'error' | 'progress' | 'long';
export function useOperation(scenario: Scenario) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success' | 'error' | 'cancelled'>(
    'idle',
  );
  const [progress, setProgress] = useState(0),
    [requests, setRequests] = useState(0);
  const running = useRef(false),
    attempt = useRef(0),
    timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => {
    clearInterval(timer.current);
    running.current = false;
  };
  useEffect(
    () => () => {
      clearInterval(timer.current);
    },
    [],
  );
  const run = () => {
    if (running.current) return;
    running.current = true;
    const thisAttempt = ++attempt.current;
    setRequests((value) => value + 1);
    setProgress(0);
    setPhase('loading');
    const start = performance.now(),
      duration = scenario === 'long' ? 7000 : scenario === 'progress' ? 4600 : 2400;
    timer.current = setInterval(() => {
      const value = Math.min(100, Math.round(((performance.now() - start) / duration) * 100));
      setProgress(value);
      if (value === 100) {
        stop();
        setPhase(scenario === 'error' && thisAttempt === 1 ? 'error' : 'success');
      }
    }, 80);
  };
  const reset = () => {
    stop();
    attempt.current = 0;
    setRequests(0);
    setProgress(0);
    setPhase('idle');
  };
  const cancel = () => {
    stop();
    setPhase('cancelled');
  };
  return { phase, progress, requests, run, reset, cancel };
}
