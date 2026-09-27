'use client';

import { useEffect, useRef, createContext, useContext } from 'react';

interface ToastData {
  id: string;
  requestId: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastCounter = 0;

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateToastId(): string {
  return `toast_${++toastCounter}_${Date.now()}`;
}

export function createToast(
  message: string,
  type: ToastData['type'],
  requestId?: string
): Omit<ToastData, 'id' | 'timestamp'> {
  return {
    message,
    type,
    requestId: requestId || generateRequestId(),
    duration: 5000,
  };
}

export function useBackendToast() {
  const addToast = (toast: Omit<ToastData, 'id' | 'timestamp'>) => {
    const id = generateToastId();
    const timestamp = Date.now();

    const fullToast: ToastData = {
      ...toast,
      id,
      timestamp,
    };

    // Attach requestId to toast for correlation
    if (!fullToast.requestId) {
      fullToast.requestId = generateRequestId();
    }

    return { id, ...fullToast };
  };

  return { addToast };
}

export function withRequestId<T extends (...args: any[]) => any>(
  fn: T,
  options?: { onSuccess?: (requestId: string, result: any) => void; onError?: (requestId: string, error: Error) => void }
): T {
  return ((...args: any[]) => {
    const requestId = generateRequestId();

    return fn(...args)
      .then((result: any) => {
        options?.onSuccess?.(requestId, result);
        return result;
      })
      .catch((error: Error) => {
        options?.onError?.(requestId, error);
        throw error;
      });
  }) as T;
}

export function toastWithRequestId(
  message: string,
  type: ToastData['type'],
  requestId: string,
  duration?: number
): ToastData {
  return {
    id: generateToastId(),
    requestId,
    message,
    type,
    timestamp: Date.now(),
    duration,
  };
}

export function useToastCorrelation() {
  const pendingRequests = useRef<Map<string, number>>(new Map());

  const trackRequest = (requestId: string, startTime: number) => {
    pendingRequests.current.set(requestId, startTime);
  };

  const completeRequest = (requestId: string) => {
    const startTime = pendingRequests.current.get(requestId);
    pendingRequests.current.delete(requestId);
    return { requestId, duration: startTime ? Date.now() - startTime : 0 };
  };

  const getPendingCount = () => pendingRequests.current.size;

  return { trackRequest, completeRequest, getPendingCount };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (toast: Omit<ToastData, 'id' | 'timestamp'>) => {
    const id = generateToastId();
    const timestamp = Date.now();
    const fullToast: ToastData = { ...toast, id, timestamp };

    setToasts((prev) => [...prev, fullToast]);

    if (fullToast.duration) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, fullToast.duration);
    }

    return { id, ...fullToast };
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
    </ToastContext.Provider>
  );
}
