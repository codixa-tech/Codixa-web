import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe } from '../data/api.js';

/** Run an async loader, re-run it whenever the data store changes or deps change. */
export function useData(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    let alive = true;
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, loading: false, error })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let cancel = run();
    const unsub = subscribe(() => {
      cancel();
      cancel = run();
    });
    return () => {
      cancel();
      unsub();
    };
  }, [run]);

  return state;
}
