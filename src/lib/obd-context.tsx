import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ObdConnection, isBluetoothSupported, isSerialSupported, type ObdStatus, type ObdTransport } from "./obd";

type Ctx = {
  status: ObdStatus;
  deviceName: string | null;
  supported: boolean;
  serialSupported: boolean;
  transport: ObdTransport | null;
  connection: ObdConnection;
  connect: (transport?: ObdTransport, baudRate?: number) => Promise<void>;
  disconnect: () => Promise<void>;
};

const LAST_TRANSPORT_KEY = "gmobd.transport";

const ObdContext = createContext<Ctx | null>(null);

export function ObdProvider({ children }: { children: React.ReactNode }) {
  const connectionRef = useRef<ObdConnection>(null as unknown as ObdConnection);
  if (!connectionRef.current) connectionRef.current = new ObdConnection();

  const [status, setStatus] = useState<ObdStatus>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [transport, setTransport] = useState<ObdTransport | null>(null);

  const connect = useCallback(async (kind: ObdTransport = "ble", baudRate = 38400) => {
    setStatus("connecting");
    try {
      const name = await connectionRef.current.connect(kind, baudRate);
      setDeviceName(name);
      setTransport(kind);
      setStatus("connected");
      window.localStorage.setItem(LAST_TRANSPORT_KEY, kind);
    } catch (error) {
      setStatus("idle");
      throw error;
    }
  }, []);

  // Silently re-open an adapter the user already authorised, so every page has data.
  useEffect(() => {
    let cancelled = false;
    const last = window.localStorage.getItem(LAST_TRANSPORT_KEY) as ObdTransport | null;
    if (!last) return;
    setStatus("connecting");
    void connectionRef.current
      .reconnectKnown(last)
      .then((name) => {
        if (cancelled) return;
        if (name) {
          setDeviceName(name);
          setTransport(last);
          setStatus("connected");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const disconnect = useCallback(async () => {
    await connectionRef.current.disconnect();
    window.localStorage.removeItem(LAST_TRANSPORT_KEY);
    setDeviceName(null);
    setTransport(null);
    setStatus("idle");
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      status,
      deviceName,
      supported: isBluetoothSupported(),
      serialSupported: isSerialSupported(),
      transport,
      connection: connectionRef.current,
      connect,
      disconnect,
    }),
    [status, deviceName, transport, connect, disconnect],
  );

  return <ObdContext.Provider value={value}>{children}</ObdContext.Provider>;
}

export function useObd() {
  const ctx = useContext(ObdContext);
  if (!ctx) throw new Error("useObd must be used inside ObdProvider");
  return ctx;
}
