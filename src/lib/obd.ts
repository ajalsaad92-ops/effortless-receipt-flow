/**
 * Minimal ELM327 client supporting two transports:
 *  - Web Bluetooth (BLE 4.0 adapters: Vgate iCar, Viecar, OBDLink CX ...)
 *  - Web Serial   (classic Bluetooth SPP adapters paired as a COM/serial port,
 *                  which is how almost every ELM327 clone appears on a laptop)
 * All browser APIs are touched lazily so the module stays SSR-safe.
 */

const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const FALLBACK_SERVICES = [UART_SERVICE, "0000fff0-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb"];

export type ObdStatus = "idle" | "connecting" | "connected";
export type ObdTransport = "ble" | "serial";

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isSerialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

type AnyBt = {
  requestDevice: (o: unknown) => Promise<any>;
};

export class ObdConnection {
  private device: any = null;
  private writer: any = null;
  private port: any = null;
  private serialWriter: any = null;
  private serialReader: any = null;
  private transport: ObdTransport = "ble";
  private open = false;
  private buffer = "";
  private resolvers: Array<(v: string) => void> = [];
  /** ELM327 handles exactly one command at a time — every send is queued. */
  private chain: Promise<unknown> = Promise.resolve();

  private pushChunk(text: string) {
    this.buffer += text;
    if (this.buffer.includes(">")) {
      const chunk = this.buffer.replace(/>/g, "").trim();
      this.buffer = "";
      const resolve = this.resolvers.shift();
      resolve?.(chunk);
    }
  }

  async connect(transport: ObdTransport = "ble", baudRate = 38400) {
    return transport === "serial" ? this.connectSerial(baudRate) : this.connectBle();
  }

  /** Classic Bluetooth SPP / USB adapters exposed as a serial port. */
  async connectSerial(baudRate = 38400) {
    if (!isSerialSupported()) throw new Error("serial-unsupported");
    const serial = (navigator as any).serial;
    const port = await serial.requestPort();
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none", bufferSize: 4096 });

    this.port = port;
    this.transport = "serial";
    this.open = true;
    this.serialWriter = port.writable.getWriter();
    this.serialReader = port.readable.getReader();

    const decoder = new TextDecoder();
    void (async () => {
      try {
        while (this.open) {
          const { value, done } = await this.serialReader.read();
          if (done) break;
          if (value) this.pushChunk(decoder.decode(value));
        }
      } catch {
        /* port closed */
      }
    })();

    await this.initAdapter();
    const info = port.getInfo?.() ?? {};
    return info.usbProductId ? `Serial ${info.usbVendorId}:${info.usbProductId}` : "ELM327 (Serial)";
  }

  /** BLE (Bluetooth 4.0+) adapters. */
  async connectBle() {
    if (!isBluetoothSupported()) throw new Error("bluetooth-unsupported");
    const bt = (navigator as unknown as { bluetooth: AnyBt }).bluetooth;
    // Show every nearby BLE device: adapter names vary wildly (OBDII, IOS-Vlink,
    // V-LINK, Konnwei, BLE-OBD ...) and name filters hide most of them.
    const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: FALLBACK_SERVICES });
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
      this.pushChunk(new TextDecoder().decode(value));
    });

    this.device = device;
    this.writer = write;
    this.transport = "ble";
    this.open = true;

    await this.initAdapter();
    return device.name ?? "OBD adapter";
  }

  private async initAdapter() {
    // Keep spaces ON (ATS1) and headers OFF so responses stay easy to parse.
    for (const cmd of ["ATZ", "ATE0", "ATL0", "ATS1", "ATH0", "ATSP0"]) {
      try {
        await this.send(cmd, 6000);
      } catch {
        /* some clones swallow the first command after reset */
      }
    }
    try {
      await this.send("0100", 9000);
    } catch {
      /* protocol search may time out on first try */
    }
  }

  get isConnected() {
    return this.transport === "serial" ? Boolean(this.port && this.open) : Boolean(this.device?.gatt?.connected);
  }

  async disconnect() {
    try {
      this.open = false;
      if (this.transport === "serial") {
        try {
          await this.serialReader?.cancel();
          this.serialReader?.releaseLock();
          this.serialWriter?.releaseLock();
          await this.port?.close();
        } catch {
          /* ignore */
        }
      } else {
        this.device?.gatt?.disconnect();
      }
    } finally {
      this.device = null;
      this.writer = null;
      this.port = null;
      this.serialWriter = null;
      this.serialReader = null;
      this.buffer = "";
      this.resolvers = [];
    }
  }

  /** Queued so two commands never overlap on the wire. */
  send(command: string, timeoutMs = 5000): Promise<string> {
    const run = this.chain.then(
      () => this.sendNow(command, timeoutMs),
      () => this.sendNow(command, timeoutMs),
    );
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async sendNow(command: string, timeoutMs: number): Promise<string> {
    if (!this.writer && !this.serialWriter) throw new Error("not-connected");
    this.buffer = "";
    this.resolvers = [];
    const payload = new TextEncoder().encode(`${command}\r`);
    let resolver: ((v: string) => void) | null = null;
    const answer = new Promise<string>((resolve, reject) => {
      resolver = resolve;
      this.resolvers.push(resolve);
      setTimeout(() => {
        this.resolvers = this.resolvers.filter((r) => r !== resolver);
        this.buffer = "";
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    if (this.serialWriter) await this.serialWriter.write(payload);
    else if (this.writer.writeValueWithoutResponse) await this.writer.writeValueWithoutResponse(payload);
    else await this.writer.writeValue(payload);
    return answer;
  }

  async readTroubleCodes(): Promise<string[]> {
    const codes = new Set<string>();
    // 03 = stored, 07 = pending, 0A = permanent — many cars only answer one of them.
    for (const mode of ["03", "07", "0A"]) {
      try {
        const raw = await this.send(mode, 7000);
        for (const code of parseDtcResponse(raw)) codes.add(code);
      } catch {
        /* mode unsupported on this ECU */
      }
    }
    return Array.from(codes);
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
    const bytes = hexBytes(raw, `01${pid}`);
    const start = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === parseInt(pid, 16));
    if (start === -1) return null;
    return bytes.slice(start + 2);
  }

  /** Ask the ECU which Mode 01 PIDs it actually supports (python-OBD style discovery). */
  async readSupportedPids(bases: readonly string[]): Promise<string[]> {
    const { decodeSupportMask } = await import("./pids");
    const found: string[] = [];
    for (const base of bases) {
      let data: number[] | null = null;
      try {
        data = await this.readPid(base);
      } catch {
        break;
      }
      if (!data || data.length < 4) break;
      const list = decodeSupportMask(parseInt(base, 16), data);
      found.push(...list);
      // stop walking when the "next block supported" bit is clear
      const nextBase = (parseInt(base, 16) + 0x20).toString(16).toUpperCase().padStart(2, "0");
      if (!list.includes(nextBase)) break;
    }
    return Array.from(new Set(found));
  }

  /** Mode 09 PID 02 — vehicle identification number. */
  async readVin(): Promise<string | null> {
    const raw = await this.send("0902");
    const bytes = hexBytes(raw, "0902");
    const chars = bytes.filter((b) => b >= 0x30 && b <= 0x5a).map((b) => String.fromCharCode(b));
    const vin = chars.join("").slice(-17);
    return vin.length === 17 ? vin : null;
  }

  /** Mode 02 — freeze frame value captured when the code was set. */
  async readFreezeFrame(pid: string): Promise<number[] | null> {
    const raw = await this.send(`02${pid}00`);
    const bytes = hexBytes(raw, `02${pid}00`);
    const start = bytes.findIndex((b, i) => b === 0x42 && bytes[i + 1] === parseInt(pid, 16));
    if (start === -1) return null;
    return bytes.slice(start + 3);
  }

  /** Probe a list of ECU addresses (DDT4All-style module discovery). */
  async discoverEcus(addresses: Array<{ header: string; ar: string; en: string }>) {
    const out: Array<{ header: string; ar: string; en: string; online: boolean; response: string }> = [];
    for (const item of addresses) {
      try {
        await this.send(`ATSH${item.header}`, 3000);
        const response = await this.send("0100", 3000);
        const online = /41\s?00/i.test(response) || /^7E|^5|^6/i.test(response.trim());
        out.push({ ...item, online, response: response.trim() });
      } catch (error) {
        out.push({ ...item, online: false, response: (error as Error).message });
      }
    }
    try {
      await this.send("ATSH7DF", 2000);
    } catch {
      /* ignore */
    }
    return out;
  }
}

/**
 * Turn a raw ELM327 reply into data bytes.
 * Handles: echoed command, spaces on/off, ISO-TP multi-line frames ("0:", "1:"),
 * status words (SEARCHING..., NO DATA, ?) and CAN length prefixes.
 */
export function hexBytes(raw: string, echo?: string): number[] {
  const out: number[] = [];
  const lines = raw.split(/[\r\n]+/);
  for (let line of lines) {
    line = line.replace(/>/g, "").trim();
    if (!line) continue;
    if (/SEARCHING|NO DATA|UNABLE|STOPPED|ERROR|BUS|CAN|\?/i.test(line)) continue;
    const compact = line.replace(/\s+/g, "").toUpperCase();
    if (!/^[0-9A-F:]+$/.test(compact)) continue;
    // multi-frame line index prefix ("0:41 00 ...")
    const body = compact.includes(":") ? compact.slice(compact.indexOf(":") + 1) : compact;
    if (echo && body === echo.toUpperCase()) continue;
    if (body.length % 2 !== 0) continue;
    for (let i = 0; i < body.length; i += 2) out.push(parseInt(body.slice(i, i + 2), 16));
  }
  return out;
}

export function parseDtcResponse(raw: string): string[] {
  const bytes = hexBytes(raw);
  // positive reply for mode 03 / 07 / 0A
  const start = bytes.findIndex((b) => b === 0x43 || b === 0x47 || b === 0x4a);
  let payload = start === -1 ? bytes : bytes.slice(start + 1);
  // CAN replies put the DTC count right after 0x43 — drop it when present.
  if (start !== -1 && payload.length % 2 === 1) payload = payload.slice(1);
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
