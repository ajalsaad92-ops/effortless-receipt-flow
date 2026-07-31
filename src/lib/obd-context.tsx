import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ObdConnection, isBluetoothSupported, type ObdStatus } from "./obd";

type Ctx = {
  status: ObdStatus;
  deviceName: string | null;
  supported: boolean;
  connection: ObdConnection;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const ObdContext = createContext<Ctx | null>(null);

export function ObdProvider({ children }: { children: React.ReactNode }) {
  const connectionRef = useRef<ObdConnection>(null as unknown as ObdConnection);
  if (!connectionRef.current) connectionRef.current = new ObdConnection();

  const [status, setStatus] = useState<ObdStatus>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const name = await connectionRef.current.connect();
      setDeviceName(name);
      setStatus("connected");
    } catch (error) {
      setStatus("idle");
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await connectionRef.current.disconnect();
    setDeviceName(null);
    setStatus("idle");
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      status,
      deviceName,
      supported: isBluetoothSupported(),
      connection: connectionRef.current,
      connect,
      disconnect,
    }),
    [status, deviceName, connect, disconnect],
  );

  return <ObdContext.Provider value={value}>{children}</ObdContext.Provider>;
}

export function useObd() {
  const ctx = useContext(ObdContext);
  if (!ctx) throw new Error("useObd must be used inside ObdProvider");
  return ctx;
}
