/**
 * Minimal ELM327 client over Web Bluetooth (Nordic UART style services).
 * All browser APIs are touched lazily so the module stays SSR-safe.
 */

const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const FALLBACK_SERVICES = [UART_SERVICE, "0000fff0-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb"];

export type ObdStatus = "idle" | "connecting" | "connected";

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

type AnyBt = {
  requestDevice: (o: unknown) => Promise<any>;
};

export class ObdConnection {
  private device: any = null;
  private writer: any = null;
  private buffer = "";
  private resolvers: Array<(v: string) => void> = [];

  async connect() {
    if (!isBluetoothSupported()) throw new Error("bluetooth-unsupported");
    const bt = (navigator as unknown as { bluetooth: AnyBt }).bluetooth;
    const device = await bt.requestDevice({
      filters: [{ namePrefix: "OBD" }, { namePrefix: "ELM" }, { namePrefix: "Viecar" }, { namePrefix: "Vgate" }],
      optionalServices: FALLBACK_SERVICES,
    });
    const server = await device.gatt.connect();

    let service: any = null;
    for (const uuid of FALLBACK_SERVICES) {
      try {
        service = await server.getPrimaryService(uuid);
        if (service) break;
      } catch {
        /* try next */
      }
    }
    if (!service) throw new Error("no-uart-service");

    const characteristics = await service.getCharacteristics();
    const notify = characteristics.find((c: any) => c.properties.notify) ?? (await service.getCharacteristic(UART_RX));
    const write =
      characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse) ??
      (await service.getCharacteristic(UART_TX));

    await notify.startNotifications();
    notify.addEventListener("characteristicvaluechanged", (event: any) => {
      const value = event.target.value as DataView;
      this.buffer += new TextDecoder().decode(value);
      if (this.buffer.includes(">")) {
        const chunk = this.buffer.replace(/>/g, "").trim();
        this.buffer = "";
        const resolve = this.resolvers.shift();
        resolve?.(chunk);
      }
    });

    this.device = device;
    this.writer = write;

    await this.send("ATZ");
    await this.send("ATE0");
    await this.send("ATSP0");
    return device.name ?? "OBD adapter";
  }

  get isConnected() {
    return Boolean(this.device?.gatt?.connected);
  }

  async disconnect() {
    try {
      this.device?.gatt?.disconnect();
    } finally {
      this.device = null;
      this.writer = null;
      this.resolvers = [];
    }
  }

  async send(command: string, timeoutMs = 5000): Promise<string> {
    if (!this.writer) throw new Error("not-connected");
    const payload = new TextEncoder().encode(`${command}\r`);
    const answer = new Promise<string>((resolve, reject) => {
      this.resolvers.push(resolve);
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    });
    if (this.writer.writeValueWithoutResponse) await this.writer.writeValueWithoutResponse(payload);
    else await this.writer.writeValue(payload);
    return answer;
  }

  async readTroubleCodes(): Promise<string[]> {
    const raw = await this.send("03");
    return parseDtcResponse(raw);
  }

  async clearTroubleCodes() {
    await this.send("04");
  }

  /** Send a sequence of raw commands (used for brand profiles and actuator tests). */
  async runCommands(commands: string[]): Promise<Array<{ command: string; response: string }>> {
    const out: Array<{ command: string; response: string }> = [];
    for (const command of commands) {
      try {
        out.push({ command, response: await this.send(command) });
      } catch (error) {
        out.push({ command, response: `ERROR: ${(error as Error).message}` });
      }
    }
    return out;
  }

  async readPid(pid: string): Promise<number[] | null> {
    const raw = await this.send(`01${pid}`);
    const bytes = raw
      .replace(/[\r\n]/g, " ")
      .split(/\s+/)
      .filter((b) => /^[0-9A-F]{2}$/i.test(b))
      .map((b) => parseInt(b, 16));
    const start = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === parseInt(pid, 16));
    if (start === -1) return null;
    return bytes.slice(start + 2);
  }
}

export function parseDtcResponse(raw: string): string[] {
  const bytes = raw
    .replace(/[\r\n>]/g, " ")
    .split(/\s+/)
    .filter((b) => /^[0-9A-F]{2}$/i.test(b))
    .map((b) => parseInt(b, 16));
  const start = bytes.indexOf(0x43);
  const payload = start === -1 ? bytes : bytes.slice(start + 1);
  const codes: string[] = [];
  for (let i = 0; i + 1 < payload.length; i += 2) {
    const a = payload[i];
    const b = payload[i + 1];
    if (a === 0 && b === 0) continue;
    const prefix = ["P", "C", "B", "U"][(a & 0xc0) >> 6];
    const digit1 = (a & 0x30) >> 4;
    const digit2 = a & 0x0f;
    const rest = b.toString(16).toUpperCase().padStart(2, "0");
    codes.push(`${prefix}${digit1}${digit2.toString(16).toUpperCase()}${rest}`);
  }
  return Array.from(new Set(codes));
}

export type LiveReading = {
  rpm: number;
  speed: number;
  coolant: number;
  load: number;
  intake: number;
  throttle: number;
  voltage: number;
};

export const LIVE_PIDS = {
  rpm: "0C",
  speed: "0D",
  coolant: "05",
  load: "04",
  intake: "0F",
  throttle: "11",
} as const;

export function decodePid(key: keyof typeof LIVE_PIDS, data: number[]): number {
  const [a = 0, b = 0] = data;
  switch (key) {
    case "rpm":
      return Math.round((a * 256 + b) / 4);
    case "speed":
      return a;
    case "coolant":
    case "intake":
      return a - 40;
    case "load":
    case "throttle":
      return Math.round((a * 100) / 255);
    default:
      return a;
  }
}

/** Smooth pseudo-random readings used by demo mode. */
export function demoReading(tick: number): LiveReading {
  const wave = (offset: number, amp: number, base: number) => base + Math.sin((tick + offset) / 6) * amp;
  return {
    rpm: Math.round(wave(0, 420, 1150)),
    speed: Math.max(0, Math.round(wave(3, 35, 42))),
    coolant: Math.round(wave(9, 4, 89)),
    load: Math.max(0, Math.round(wave(2, 22, 34))),
    intake: Math.round(wave(5, 6, 38)),
    throttle: Math.max(0, Math.round(wave(1, 18, 22))),
    voltage: Number(wave(7, 0.25, 14.1).toFixed(1)),
  };
}
