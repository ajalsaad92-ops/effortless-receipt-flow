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

/** Line is considered flushed once this long passes with no bytes arriving. */
const DRAIN_QUIET_MS = 150;
/** Never spend longer than this flushing, however chatty the adapter is. */
const DRAIN_MAX_MS = 800;

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

/**
 * True when `chunk` could plausibly be the answer to `command`.
 *
 * A positive OBD reply echoes the mode with bit 6 set (01 -> 41, 03 -> 43 ...)
 * and, for modes 01/02/09, the requested PID as well. Checking that envelope is
 * what lets a late reply from a command that already timed out be recognised
 * and dropped, instead of being returned as though it answered the command
 * running now — which is how a coolant read could come back holding RPM data.
 */
export function replyMatches(command: string, chunk: string): boolean {
  const cmd = command.trim().toUpperCase();
  if (!/^[0-9A-F]{2,}$/.test(cmd)) return true; // AT... and anything non-hex
  const upper = chunk.toUpperCase();
  // Adapter and ECU status replies are legitimate answers to any command.
  if (/NO DATA|ERROR|UNABLE|STOPPED|SEARCHING|BUS |^\s*\?|7F/.test(upper)) return true;

  const mode = parseInt(cmd.slice(0, 2), 16);
  if (Number.isNaN(mode)) return true;
  let expected = (mode + 0x40).toString(16).toUpperCase().padStart(2, "0");
  // Modes 01, 02 and 09 echo the PID back, which is the only thing that
  // distinguishes one Mode 01 reply from another.
  if ((mode === 0x01 || mode === 0x02 || mode === 0x09) && cmd.length >= 4) {
    expected += cmd.slice(2, 4);
  }

  return upper.split(/[\r\n]+/).some((line) => {
    const body = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
    const hex = body.replace(/[^0-9A-F]/g, "");
    return hex.startsWith(expected);
  });
}

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
  /**
   * Monotonic request id. A command that already timed out must never be able
   * to touch the state of the command that replaced it, so both the timeout
   * timer and any late-arriving bytes are checked against the current ticket.
   */
  private seq = 0;
  /**
   * Set when a command times out. The adapter may still push the reply it owed
   * us — a slow ECU or a protocol search rather than a lost frame — and that
   * orphan used to be handed to whichever command ran next, so a coolant read
   * could come back holding RPM data. We flush the line before the next write
   * instead of guessing which frame is stale.
   */
  private needsDrain = false;
  /** Counts inbound chunks; only used to detect when the line has gone quiet. */
  private rxCount = 0;
  /** The command currently awaiting a reply, so orphans can be recognised. */
  private awaiting: string | null = null;

  private pushChunk(text: string) {
    this.rxCount += 1;
    // Nothing is in flight, so these bytes belong to a command that already
    // gave up. Never let them satisfy a future one.
    if (this.resolvers.length === 0) {
      this.buffer = "";
      return;
    }
    this.buffer += text;
    if (this.buffer.includes(">")) {
      const chunk = this.buffer.replace(/>/g, "").trim();
      this.buffer = "";
      // Wrong envelope: this belongs to a command we already gave up on. Drop
      // it and keep waiting rather than answering with another PID's data.
      if (this.awaiting && !replyMatches(this.awaiting, chunk)) return;
      const resolve = this.resolvers.shift();
      resolve?.(chunk);
    }
  }

  /**
   * Discard whatever the adapter is still sending until the line goes quiet.
   * No resolver is registered while this runs, so a valid reply can never be
   * thrown away — which is what stops a timeout from cascading into every
   * command after it.
   */
  private async drain() {
    this.needsDrain = false;
    this.resolvers = [];
    this.awaiting = null;
    this.buffer = "";
    const started = Date.now();
    let lastActivity = Date.now();
    while (Date.now() - started < DRAIN_MAX_MS) {
      const before = this.rxCount;
      await new Promise((resolve) => setTimeout(resolve, 25));
      if (this.rxCount !== before) lastActivity = Date.now();
      else if (Date.now() - lastActivity >= DRAIN_QUIET_MS) return;
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
      this.handleDrop();
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
    device.addEventListener?.("gattserverdisconnected", () => this.handleDrop());

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
      // Invalidate every in-flight ticket so a reply that lands after teardown
      // cannot resolve a command from the previous session.
      this.seq += 1;
      this.needsDrain = false;
      this.awaiting = null;
      this.device = null;
      this.writer = null;
      this.port = null;
      this.serialWriter = null;
      this.serialReader = null;
      this.buffer = "";
      this.resolvers = [];
    }
  }

  /**
   * Called when the adapter goes away on its own (out of BLE range, unplugged,
   * car switched off) rather than through {@link disconnect}. Without this the
   * UI kept showing "connected" while every command silently timed out.
   */
  onDrop: (() => void) | null = null;

  private handleDrop() {
    if (!this.open) return;
    this.open = false;
    this.seq += 1;
    this.needsDrain = false;
    this.awaiting = null;
    this.buffer = "";
    this.resolvers = [];
    this.writer = null;
    this.serialWriter = null;
    this.onDrop?.();
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
    if (this.needsDrain) await this.drain();
    const ticket = ++this.seq;
    this.buffer = "";
    this.resolvers = [];
    this.awaiting = command;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const answer = new Promise<string>((resolve, reject) => {
      this.resolvers.push(resolve);
      timer = setTimeout(() => {
        // A timer that outlived its own command must not clear the buffer of
        // whichever command is running now — that used to truncate multi-frame
        // replies (VIN, mode 09 text, multi-DTC mode 03).
        if (ticket !== this.seq) return;
        this.resolvers = [];
        this.awaiting = null;
        this.buffer = "";
        this.needsDrain = true;
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    const payload = new TextEncoder().encode(`${command}\r`);
    try {
      if (this.serialWriter) await this.serialWriter.write(payload);
      else if (this.writer.writeValueWithoutResponse) await this.writer.writeValueWithoutResponse(payload);
      else await this.writer.writeValue(payload);
      return await answer;
    } finally {
      clearTimeout(timer);
    }
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

  /** DTCs split per mode: 03 stored, 07 pending, 0A permanent. */
  async readTroubleCodesByMode(): Promise<{ stored: string[]; pending: string[]; permanent: string[] }> {
    const out = { stored: [] as string[], pending: [] as string[], permanent: [] as string[] };
    const modes = [
      ["03", "stored"],
      ["07", "pending"],
      ["0A", "permanent"],
    ] as const;
    for (const [mode, key] of modes) {
      try {
        out[key] = parseDtcResponse(await this.send(mode, 7000));
      } catch {
        /* mode unsupported */
      }
    }
    return out;
  }

  /** Mode 01 PID 01 — MIL lamp state and stored DTC count. */
  async readMilStatus(): Promise<{ mil: boolean; count: number } | null> {
    try {
      const data = await this.readPid("01");
      if (!data || data.length < 1) return null;
      return { mil: Boolean(data[0] & 0x80), count: data[0] & 0x7f };
    } catch {
      return null;
    }
  }

  /** Mode 09 free-text info (04 = CALID, 06 = CVN, 0A = ECU name). */
  async readMode09Text(pid: string): Promise<string | null> {
    try {
      const raw = await this.send(`09${pid}`, 6000);
      const bytes = hexBytes(raw, `09${pid}`);
      const text = bytes
        .filter((b) => b >= 0x20 && b <= 0x7e)
        .map((b) => String.fromCharCode(b))
        .join("")
        .trim();
      return text.length >= 3 ? text : null;
    } catch {
      return null;
    }
  }

  /** Adapter-reported protocol name (ATDP) and battery voltage (ATRV). */
  async readAdapterInfo(): Promise<{ protocol: string | null; voltage: number | null }> {
    let protocol: string | null = null;
    let voltage: number | null = null;
    try {
      protocol = (await this.send("ATDP", 4000)).replace(/[\r\n>]/g, "").trim() || null;
    } catch {
      /* ignore */
    }
    try {
      const parsed = parseFloat((await this.send("ATRV", 3000)).replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(parsed) && parsed > 5 && parsed < 20) voltage = parsed;
    } catch {
      /* ignore */
    }
    return { protocol, voltage };
  }

  /** Reconnect to an already-granted BLE device / serial port without a picker. */
  async reconnectKnown(transport: ObdTransport, baudRate = 38400): Promise<string | null> {
    if (transport === "serial") {
      if (!isSerialSupported()) return null;
      const ports = await (navigator as any).serial.getPorts();
      const port = ports?.[0];
      if (!port) return null;
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
          /* closed */
        }
        this.handleDrop();
      })();
      await this.initAdapter();
      return "ELM327 (Serial)";
    }

    if (!isBluetoothSupported()) return null;
    const bt = (navigator as any).bluetooth;
    if (typeof bt.getDevices !== "function") return null;
    const devices = await bt.getDevices();
    if (!devices?.length) return null;
    for (const device of devices) {
      try {
        const server = await device.gatt.connect();
        let service: any = null;
        for (const uuid of FALLBACK_SERVICES) {
          try {
            service = await server.getPrimaryService(uuid);
            if (service) break;
          } catch {
            /* next */
          }
        }
        if (!service) continue;
        const characteristics = await service.getCharacteristics();
        const notify = characteristics.find((c: any) => c.properties.notify);
        const write = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
        if (!notify || !write) continue;
        await notify.startNotifications();
        notify.addEventListener("characteristicvaluechanged", (event: any) => {
          this.pushChunk(new TextDecoder().decode(event.target.value as DataView));
        });
        this.device = device;
        this.writer = write;
        this.transport = "ble";
        this.open = true;
        device.addEventListener?.("gattserverdisconnected", () => this.handleDrop());
        await this.initAdapter();
        return device.name ?? "OBD adapter";
      } catch {
        /* try next known device */
      }
    }
    return null;
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

  /** Deep-probe one module: supported PIDs, its own DTCs and VIN (if it answers). */
  async probeEcu(header: string): Promise<{ pids: string[]; dtcs: string[]; vin: string | null; raw: string }> {
    let pids: string[] = [];
    let dtcs: string[] = [];
    let vin: string | null = null;
    let raw = "";
    try {
      await this.send(`ATSH${header}`, 3000);
      try {
        raw = await this.send("0100", 4000);
      } catch {
        /* ignore */
      }
      try {
        pids = await this.readSupportedPids(["00", "20", "40", "60", "80", "A0", "C0"]);
      } catch {
        /* ignore */
      }
      try {
        dtcs = parseDtcResponse(await this.send("03", 6000));
      } catch {
        /* ignore */
      }
      try {
        vin = await this.readVin();
      } catch {
        /* ignore */
      }
    } finally {
      try {
        await this.send("ATSH7DF", 2000);
      } catch {
        /* ignore */
      }
    }
    return { pids, dtcs, vin, raw: raw.trim() };
  }

  /** Read one PID from a specific module address. */
  async readPidFrom(header: string, pid: string): Promise<number[] | null> {
    try {
      await this.send(`ATSH${header}`, 3000);
      return await this.readPid(pid);
    } finally {
      try {
        await this.send("ATSH7DF", 2000);
      } catch {
        /* ignore */
      }
    }
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

/**
 * `null` means "not read from this car yet" — it is deliberately distinct from
 * a real 0. Diagnostic rules skip null fields instead of judging them, so the
 * app can never report a verdict (e.g. "charging system healthy") based on a
 * value the ECU never actually returned.
 */
export type LiveReading = {
  rpm: number | null;
  speed: number | null;
  coolant: number | null;
  load: number | null;
  intake: number | null;
  throttle: number | null;
  voltage: number | null;
};

export const EMPTY_READING: LiveReading = {
  rpm: null,
  speed: null,
  coolant: null,
  load: null,
  intake: null,
  throttle: null,
  voltage: null,
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
