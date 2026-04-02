// @flow
import { useEffect, useCallback, useRef } from 'react';
import { useIsMounted } from './UseIsMounted';
import debounce from 'lodash/debounce';

// Function taken from https://stackoverflow.com/questions/54666401/how-to-use-throttle-or-debounce-with-react-hook/62017005#62017005

/**
 * Debounces a React callback with a specified delay.
 * The returned function has .cancel() and .flush() methods
 * from lodash/debounce, so callers can cancel pending invocations.
 */
export const useDebounce = (cb: any, delay: number): any => {
  const isMounted = useIsMounted();
  const cbRef = useRef(cb);
  const delayRef = useRef(delay);

  // Keep refs up-to-date so the debounced function always calls the latest cb.
  useEffect(() => {
    cbRef.current = cb;
    delayRef.current = delay;
  }, [cb, delay]);

  // Create a stable debounced function that delegates to the latest cb via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFn = useCallback(
    debounce(
      (...args: any) => {
        if (isMounted.current) {
          cbRef.current(...args);
        }
      },
      delay
    ),
    [delay, isMounted]
  );

  // Clean up on unmount: cancel any pending debounced calls.
  useEffect(() => {
    return () => {
      debouncedFn.cancel();
    };
  }, [debouncedFn]);

  return debouncedFn;
};
