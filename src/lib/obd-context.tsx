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
  /**
   * Who currently owns the adapter, or null. There is one physical serial line
   * and ELM327 answers one command at a time, so a background poller and the
   * assistant's tool calls would otherwise queue behind each other — a 10s
   * `monitor_sensors` would starve the live gauges completely.
   */
  owner: string | null;
  acquire: (owner: string) => boolean;
  release: (owner: string) => void;
};

const LAST_TRANSPORT_KEY = "gmobd.transport";

const ObdContext = createContext<Ctx | null>(null);

export function ObdProvider({ children }: { children: React.ReactNode }) {
  const connectionRef = useRef<ObdConnection>(null as unknown as ObdConnection);
  if (!connectionRef.current) connectionRef.current = new ObdConnection();

  const [status, setStatus] = useState<ObdStatus>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [transport, setTransport] = useState<ObdTransport | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  // Web Bluetooth / Web Serial obviously do not exist during SSR, so probing
  // them at render time made the server and the first client render disagree
  // and React threw the whole tree away. Resolve after mount instead.
  const [capabilities, setCapabilities] = useState({ ble: false, serial: false });

  useEffect(() => {
    setCapabilities({ ble: isBluetoothSupported(), serial: isSerialSupported() });
  }, []);

  const acquire = useCallback((next: string) => {
    let granted = false;
    setOwner((current) => {
      granted = current === null || current === next;
      return granted ? next : current;
    });
    return granted;
  }, []);

  const release = useCallback((next: string) => {
    setOwner((current) => (current === next ? null : current));
  }, []);

  // The adapter can vanish without us asking (out of range, unplugged, ignition
  // off). Reflect that immediately instead of leaving the header on "connected"
  // while every command quietly times out.
  useEffect(() => {
    const connection = connectionRef.current;
    connection.onDrop = () => {
      setStatus("idle");
      setDeviceName(null);
      setTransport(null);
      setOwner(null);
    };
    return () => {
      connection.onDrop = null;
    };
  }, []);

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
      supported: capabilities.ble,
      serialSupported: capabilities.serial,
      transport,
      connection: connectionRef.current,
      connect,
      disconnect,
      owner,
      acquire,
      release,
    }),
    [status, deviceName, transport, connect, disconnect, owner, acquire, release, capabilities],
  );

  return <ObdContext.Provider value={value}>{children}</ObdContext.Provider>;
}

export function useObd() {
  const ctx = useContext(ObdContext);
  if (!ctx) throw new Error("useObd must be used inside ObdProvider");
  return ctx;
}
