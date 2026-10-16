import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, toApiError } from "../api/errors";

export function useMutation<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (...args: Args): Promise<Result> => {
    if (busy.current)
      throw new ApiError(0, "PENDING", "Дождитесь завершения операции");
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      return await actionRef.current(...args);
    } catch (err) {
      const e = toApiError(err);
      if (mounted.current) setError(e);
      throw e;
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);
  return { run, isLoading, error, clearError: () => setError(null) };
}
