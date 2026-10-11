import { useEffect, useRef, useState } from "react";

import { storageGet, storageSet, subscribeStorage } from "../lib/storage";

type Updater<T> = T | ((previous: T) => T);

export function useChromeStorage<T>(key: string, fallbackValue: T) {
  const [value, setValueState] = useState<T>(fallbackValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const valueRef = useRef(value);
  const fallbackRef = useRef(fallbackValue);
  fallbackRef.current = fallbackValue;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let isMounted = true;

    const loadValue = async () => {
      try {
        const storedValue = await storageGet(key, fallbackRef.current);

        if (!isMounted) {
          return;
        }

        valueRef.current = storedValue;
        setValueState(storedValue);
        setError(null);
      } catch (storageError) {
        if (!isMounted) {
          return;
        }

        const message =
          storageError instanceof Error ? storageError.message : "读取本地配置失败。";
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadValue();

    const unsubscribe = subscribeStorage<T>(key, fallbackRef.current, (nextValue) => {
      valueRef.current = nextValue;
      setValueState(nextValue);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [key]);

  const setValue = async (updater: Updater<T>) => {
    const previousValue = valueRef.current;
    const nextValue =
      typeof updater === "function"
        ? (updater as (previous: T) => T)(valueRef.current)
        : updater;

    valueRef.current = nextValue;
    setValueState(nextValue);

    try {
      const saved = await storageSet(key, nextValue, previousValue);
      valueRef.current = saved;
      setValueState(saved);
      setError(null);
    } catch (storageError) {
      const message =
        storageError instanceof Error ? storageError.message : "写入本地配置失败。";
      setError(message);
      throw storageError;
    }
  };

  return {
    value,
    setValue,
    isLoading,
    error
  };
}
