"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoDismissState(delay = 6000) {
  const [value, setValueState] = useState("");
  const timeoutRef = useRef<number | null>(null);

  const setValue = useCallback(
    (nextValue: string) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      setValueState(nextValue);

      if (!nextValue) {
        timeoutRef.current = null;
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        setValueState("");
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, setValue] as const;
}
