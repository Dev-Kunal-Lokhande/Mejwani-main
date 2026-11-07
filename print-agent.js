const net = require('net');
const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ==========================================
// 1. CONFIGURATION
// ==========================================
const CONFIG = {
  BACKEND_URL: 'https://mejwani.onrender.com', // Your deployed backend Render URL
  USERNAME: 'admin_hotelpranav9506', // Your admin username/email
  PASSWORD: 'MEJ9506', // Your admin password

  PRINTER_MODE: 'USB', // Set to 'USB' for USB cable connection, or 'LAN' for network connection
  PRINTER_SHARE_NAME: 'MejwaniPrinter', // Share name of printer in Windows (for USB mode)

  PRINTER_IP: '192.168.1.20', // Your printer IP address (for LAN mode)
  PRINTER_PORT: 9100, // Your printer port (standard port is 9100)
  POLL_INTERVAL_MS: 1000, // Poll every 1 second for new receipts
  HEARTBEAT_INTERVAL_MS: 15000, // Heartbeat every 15 seconds to stay registered ONLINE
};

const formatDateDDMMYYYY = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day} - ${month} - ${year}`;
};

const formatDateTimeDDMMYYYY = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const datePart = formatDateDDMMYYYY(d);
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart} ${timePart}`;
};

// Load dynamic config from external config.json if present
const isPackaged = typeof process.pkg !== 'undefined';
const configDir = isPackaged ? path.dirname(process.execPath) : __dirname;
const configPath = path.join(configDir, 'config.json');

if (fs.existsSync(configPath)) {
  try {
    const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    Object.assign(CONFIG, loadedConfig);
    console.log(`[Agent] Loaded configuration from: ${configPath}`);
  } catch (err) {
    console.error(`[Agent] Error parsing config.json: ${err.message}`);
  }
} else {
  try {
    fs.writeFileSync(configPath, JSON.stringify(CONFIG, null, 2), 'utf8');
    console.log(`[Agent] Created default config.json template at: ${configPath}`);
  } catch (err) {
    console.error(`[Agent] Failed to create default config.json: ${err.message}`);
  }
}

const completedJobIds = new Set();
const acknowledgedJobIds = new Set();
const activeJobIds = new Set();
const addCompletedJobId = (jobId) => {
  if (!jobId) return;
  completedJobIds.add(String(jobId));
  if (completedJobIds.size > 200) {
    const firstVal = completedJobIds.values().next().value;
    completedJobIds.delete(firstVal);
  }
};

// ==========================================
// 2. HTTP/HTTPS REQUEST HELPER (Zero Dependencies)
// ==========================================
const makeRequest = (method, endpoint, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(CONFIG.BACKEND_URL + endpoint);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const dataStr = body ? JSON.stringify(body) : '';
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: method,
      headers: headers,
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(dataStr);
    }
    req.end();
  });
};

// ==========================================
// 3. ESC/POS BUILDER & COMPILER
// ==========================================
class EscPosBuilder {
  constructor() {
    this.buffer = [];
  }
  init() {
    this.buffer.push(Buffer.from([0x1b, 0x40]));
    return this;
  }
  align(alignment) {
    this.buffer.push(Buffer.from([0x1b, 0x61, alignment]));
    return this;
  }
  bold(enable) {
    this.buffer.push(Buffer.from([0x1b, 0x45, enable ? 1 : 0]));
    return this;
  }
  sizeDouble(enable) {
    this.buffer.push(Buffer.from([0x1d, 0x21, enable ? 0x11 : 0x00]));
    return this;
  }
  text(str) {
    this.buffer.push(Buffer.from(str, 'ascii'));
    return this;
  }
  line(str = '') {
    this.text(str + '\n');
    return this;
  }
  feed(n = 1) {
    this.buffer.push(Buffer.from([0x1b, 0x64, n]));
    return this;
  }
  cut() {
    // Cutter command: GS V 66 0
    this.buffer.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
    return this;
  }
  beep(n = 3, t = 3) {
    // 1. ESC B n t (hex: 1b 42 n t) - Standard/Xprinter/Rongta internal buzzer
    this.buffer.push(Buffer.from([0x1b, 0x42, n, t]));
    // 2. ESC ( A pL pH n m (hex: 1b 28 41 02 00 n t) - Epson native internal buzzer
    this.buffer.push(Buffer.from([0x1b, 0x28, 0x41, 0x02, 0x00, n, t]));
    // 3. ESC GS BEL m t1 t2 (hex: 1b 1d 07 m t1 t2) - Star Micronics buzzer
    this.buffer.push(Buffer.from([0x1b, 0x1d, 0x07, 0x01, n, t]));
    // 4. BEL (hex: 07) - Standard ASCII beep character
    this.buffer.push(Buffer.from([0x07]));
    // 5. ESC p m t1 t2 (hex: 1b 70 00 1e ff) - Drawer kick-out pin 2 (external buzzer)
    this.buffer.push(Buffer.from([0x1b, 0x70, 0x00, 0x1e, 0xff]));
    // 6. ESC p m t1 t2 (hex: 1b 70 01 1e ff) - Drawer kick-out pin 5 (external buzzer)
    this.buffer.push(Buffer.from([0x1b, 0x70, 0x01, 0x1e, 0xff]));
    return this;
  }
  getBuffer() {
    return Buffer.concat(this.buffer);
  }
}

const formatLeftRightLine = (left, right, limit = 48) => {
  const leftStr = String(left);
  const rightStr = String(right);
  const padLength = limit - leftStr.length - rightStr.length;
  return leftStr + ' '.repeat(padLength > 0 ? padLength : 1) + rightStr;
};

const compileBillPayload = (billData) => {
  const {
    hotelName = 'MEJWANI RESTAURANT',
    address = '',
    phone = '',
    gstNumber = '',
    orderId = 'DRAFT',
    tableName = 'COUNTER',
    dateTime = formatDateTimeDDMMYYYY(new Date()),
    captainName = 'ADMIN',
    items = [],
    subtotal = 0,
    cgst = 0,
    sgst = 0,
    serviceCharge = 0,
    grandTotal = 0,
    cgstRate = 0,
    sgstRate = 0,
    serviceChargeRate = 0
  } = billData;

  const builder = new EscPosBuilder();
  builder.init();

  // Header (Align Center, Double Width & Height, Bold)
  builder.align(1).sizeDouble(true).bold(true).line(hotelName.toUpperCase());
  builder.sizeDouble(false).bold(false);
  if (address) builder.line(address);
  if (phone) builder.line(`Phone: ${phone}`);
  if (gstNumber) builder.line(`GSTIN: ${gstNumber}`);

  builder.align(0).line('-'.repeat(48));

  // Meta details
  builder.line(formatLeftRightLine(`Invoice: ${orderId}`, `Table: ${tableName}`));
  builder.line(formatLeftRightLine(`Date: ${dateTime}`, `Capt: ${captainName}`));

  builder.line('-'.repeat(48));

  // Items Header
  // Item Description (28 chars) | Qty (6 chars) | Amount (14 chars)
  const itemHeader = 'Item Description'.padEnd(28, ' ') + 'Qty'.padStart(4, ' ').padEnd(6, ' ') + 'Amount'.padStart(14, ' ');
  builder.bold(true).line(itemHeader).bold(false);
  builder.line('-'.repeat(48));

  // Items List
  items.forEach(item => {
    const qty = item.quantity || item.qty || 1;
    const price = item.price || item.amount || 0;

    const nameStr = (item.name || '').toUpperCase().substring(0, 27).padEnd(28, ' ');
    const qtyStr = qty.toString().padStart(4, ' ').padEnd(6, ' ');
    const amtStr = (`Rs.${parseFloat(price * qty).toFixed(0)}`).padStart(14, ' ');

    builder.bold(true).line(nameStr + qtyStr + amtStr).bold(false);
    builder.line(`   ${qty} x Rs.${parseFloat(price).toFixed(0)}`);
  });

  builder.line('-'.repeat(48));

  // Financials
  builder.line(formatLeftRightLine('Subtotal', `Rs.${parseFloat(subtotal).toFixed(2)}`));
  if (Number(cgstRate) > 0) {
    builder.line(formatLeftRightLine(`CGST (${cgstRate}%)`, `Rs.${parseFloat(cgst).toFixed(2)}`));
  }
  if (Number(sgstRate) > 0) {
    builder.line(formatLeftRightLine(`SGST (${sgstRate}%)`, `Rs.${parseFloat(sgst).toFixed(2)}`));
  }
  if (Number(serviceCharge) > 0) {
    builder.line(formatLeftRightLine(`Service Charge (${serviceChargeRate}%)`, `Rs.${parseFloat(serviceCharge).toFixed(2)}`));
  }

  builder.line('='.repeat(48));

  // Grand Total
  builder.bold(true);
  builder.line(formatLeftRightLine('GRAND TOTAL', `Rs.${parseFloat(grandTotal).toFixed(0)}`));
  builder.bold(false);

  builder.line('-'.repeat(48));

  // Footer
  builder.align(1).bold(true).line('THANK YOU VISIT AGAIN').bold(false);
  builder.line('- End of Receipt -');

  // Feed & Cut
  builder.feed(3);
  // Send exactly 2 cutter commands (ESC i and ESC m) supported by POS-80C/Xprinter/Rongta
  builder.buffer.push(Buffer.from([0x1b, 0x69]));             // ESC i (Full Cut)
  builder.buffer.push(Buffer.from([0x1b, 0x6d]));             // ESC m (Partial Cut)

  return builder.getBuffer();
};

const compileKOTPayload = (kotData) => {
  const {
    title = 'KITCHEN ORDER TICKET',
    hotelName = 'MEJWANI',
    tableName = 'COUNTER',
    sectionName = 'MAIN',
    captainName = 'ADMIN',
    orderId = 'NEW ORDER',
    dateTime = formatDateTimeDDMMYYYY(new Date()),
    items = []
  } = kotData;

  const builder = new EscPosBuilder();
  builder.init();
  builder.beep();

  // Header
  builder.align(1).sizeDouble(true).bold(true).line(title);

  builder.align(0).line('='.repeat(48));

  // Meta
  builder.line(formatLeftRightLine(`Table: ${tableName} (${sectionName})`, `Capt: ${captainName}`));
  builder.line(formatLeftRightLine(`Date: ${dateTime}`, `KOT: ${orderId}`));

  builder.line('-'.repeat(48));

  // Table header
  // Item Description (38 chars) | Qty (10 chars)
  const headerLine = 'Item Description'.padEnd(38, ' ') + 'Qty'.padStart(10, ' ');
  builder.bold(true).line(headerLine).bold(false);
  builder.line('-'.repeat(48));

  // Items
  items.forEach(item => {
    const qty = item.quantity || item.qty || 1;
    const nameStr = (item.name || '').toUpperCase().substring(0, 37).padEnd(38, ' ');
    const qtyStr = qty.toString().padStart(10, ' ');

    builder.bold(true).line(nameStr + qtyStr).bold(false);
    if (item.note) {
      builder.line(`   * NOTE: ${item.note}`);
    }
  });

  builder.line('-'.repeat(48));

  // Footer (blank space to save print size)
  builder.line('\n\n\n');

  // Feed & Cut
  builder.beep();
  builder.feed(3);
  builder.cut();

  return builder.getBuffer();
};

const compileTestPayload = (testData) => {
  const { hotelName = 'MEJWANI TEST', dateTime = formatDateTimeDDMMYYYY(new Date()), message = 'Test print' } = testData;
  const builder = new EscPosBuilder();
  builder.init();
  builder.beep();
  builder.align(1).sizeDouble(true).bold(true).line(hotelName);
  builder.sizeDouble(false).bold(false).feed(1);
  builder.align(0).line(`Date/Time: ${dateTime}`);
  builder.line('-'.repeat(48));
  builder.line(message);
  builder.line('-'.repeat(48));
  builder.beep();
  builder.feed(3);
  builder.cut();
  return builder.getBuffer();
};

// ==========================================
// 4. TCP SOCKET DIRECT WRITER & DISCOVERY HELPERS
// ==========================================
let localPrinterConfig = null;
let cachedPrinters = [];

const refreshPrintersCache = async () => {
  try {
    cachedPrinters = await getWindowsPrinters();
  } catch (err) {
    console.warn('[Agent] Failed to refresh printers cache:', err.message);
  }
};


const isIPv4 = (str) => {
  if (typeof str !== 'string') return false;
  const ip = str.split(':')[0].trim();
  const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipPattern);
  if (!match) return false;
  return match.slice(1).every(num => {
    const val = parseInt(num, 10);
    return val >= 0 && val <= 255;
  });
};

const isPrinterReachable = (ip, port = 9100) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(port, ip, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

const getWindowsPrinters = () => {
  return new Promise((resolve) => {
    const cmd = `powershell -Command "Get-Printer | Select-Object Name, Type, PortName | ConvertTo-Json"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error('[Agent] Failed to list Windows printers:', stderr || err.message);
        return resolve([]);
      }
      try {
        if (!stdout || stdout.trim() === '') {
          return resolve([]);
        }
        const parsed = JSON.parse(stdout);
        const list = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
        resolve(list.map(p => ({
          name: p.Name,
          type: p.Type === 1 ? 'network' : 'usb',
          port: p.PortName
        })));
      } catch (e) {
        console.error('[Agent] Failed to parse Windows printers JSON:', e.message);
        resolve([]);
      }
    });
  });
};

const discoverPrinters = async () => {
  const winPrinters = await getWindowsPrinters();
  cachedPrinters = winPrinters;
  const printers = [];

  // 1. Process Windows printers
  for (const p of winPrinters) {
    let type = 'usb';
    let ip = null;
    let online = true;

    // Check if it's a network printer by name, port, or type
    const ipMatch = p.port && p.port.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (ipMatch || p.type === 'network' || p.name.toLowerCase().includes('network') || p.port.startsWith('IP_')) {
      type = 'network';
      ip = ipMatch ? ipMatch[1] : (p.port.startsWith('IP_') ? p.port.substring(3) : p.port);
      if (ip && ip.includes('_')) {
        ip = ip.split('_')[0];
      }
      // If we extracted a valid IP, clean it up
      if (ip && !ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        ip = null;
      }

      const checkIp = ip || CONFIG.PRINTER_IP;
      online = await isPrinterReachable(checkIp, 9100);
    } else {
      // USB printer
      online = true;
    }

    printers.push({
      name: p.name,
      type: type,
      ip: ip || undefined,
      port: type === 'network' ? 9100 : undefined,
      online: online
    });
  }

  // 2. Always check and add the default configured network printer IP (CONFIG.PRINTER_IP)
  const defaultIp = CONFIG.PRINTER_IP;
  const alreadyHasDefault = printers.some(p => p.ip === defaultIp || p.name === defaultIp);

  if (!alreadyHasDefault) {
    const isOnline = await isPrinterReachable(defaultIp, CONFIG.PRINTER_PORT || 9100);
    printers.push({
      name: defaultIp,
      type: 'network',
      ip: defaultIp,
      port: CONFIG.PRINTER_PORT || 9100,
      online: isOnline
    });
  }

  return printers;
};

const ensureRawPrinterHelperCompiled = () => {
  return new Promise((resolve) => {
    const agentDir = isPackaged ? path.dirname(process.execPath) : __dirname;
    const exePath = path.join(agentDir, 'RawPrinterHelper.exe');
    const csPath = path.join(agentDir, 'RawPrinterHelper.cs');

    if (fs.existsSync(exePath)) {
      return resolve(exePath);
    }

    console.log('[Agent] RawPrinterHelper.exe not found. Compiling from source...');

    const csharpCode = `
using System;
using System.Runtime.InteropServices;
using System.IO;

public class RawPrinterHelper {
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            throw new Exception("OpenPrinter failed with error: " + err);
        }
        DOCINFOA di = new DOCINFOA { pDocName = "Mejwani Print Agent Job", pDataType = "RAW" };
        if (!StartDocPrinter(hPrinter, 1, di)) {
            ClosePrinter(hPrinter);
            int err = Marshal.GetLastWin32Error();
            throw new Exception("StartDocPrinter failed with error: " + err);
        }
        if (!StartPagePrinter(hPrinter)) {
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            int err = Marshal.GetLastWin32Error();
            throw new Exception("StartPagePrinter failed with error: " + err);
        }
        IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pBytes, bytes.Length);
        int dwWritten;
        bool success = WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pBytes);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        if (!success) {
            int err = Marshal.GetLastWin32Error();
            throw new Exception("WritePrinter failed with error: " + err);
        }
        return true;
    }

    public static int Main(string[] args) {
        if (args.Length < 2) {
            Console.WriteLine("Usage: RawPrinterHelper.exe <PrinterName> <FilePath>");
            return 1;
        }
        try {
            string printerName = args[0];
            string filePath = args[1];
            if (!File.Exists(filePath)) {
                Console.WriteLine("Error: File not found " + filePath);
                return 2;
            }
            byte[] bytes = File.ReadAllBytes(filePath);
            SendBytesToPrinter(printerName, bytes);
            Console.WriteLine("Success");
            return 0;
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
            return 3;
        }
    }
}
`;

    try {
      fs.writeFileSync(csPath, csharpCode, 'utf8');
      const compilerCmd = `C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /target:exe /out:"${exePath}" "${csPath}"`;
      exec(compilerCmd, (err, stdout, stderr) => {
        // Clean up source file
        try { fs.unlinkSync(csPath); } catch (e) { }

        if (err) {
          console.error('[Agent] C# helper compilation failed:', stderr || err.message);
          resolve(null);
        } else {
          console.log('[Agent] C# helper compiled successfully to:', exePath);
          resolve(exePath);
        }
      });
    } catch (e) {
      console.error('[Agent] C# helper write/compile exception:', e.message);
      resolve(null);
    }
  });
};

const sendToLocalPrinter = async (buffer, target = null) => {
  let isNetwork = false;
  let ip = CONFIG.PRINTER_IP;
  let port = CONFIG.PRINTER_PORT || 9100;
  let printerName = CONFIG.PRINTER_SHARE_NAME;

  if (target) {
    const hasNetworkType = target.type === 'network';
    const hasIpTarget = target.target && isIPv4(target.target);
    const hasIpName = target.name && isIPv4(target.name);
    const hasIpKey = target.ip && isIPv4(target.ip);

    if (hasNetworkType || hasIpTarget || hasIpName || hasIpKey) {
      isNetwork = true;
      let rawTarget = target.ip || target.target || target.name;
      if (typeof rawTarget === 'string') {
        const parts = rawTarget.split(':');
        ip = parts[0].trim();
        if (parts[1]) {
          port = parseInt(parts[1].trim(), 10) || 9100;
        } else {
          port = target.port || 9100;
        }
      } else {
        ip = CONFIG.PRINTER_IP;
        port = target.port || CONFIG.PRINTER_PORT || 9100;
      }
    } else {
      isNetwork = false;
      printerName = target.name || target.target || CONFIG.PRINTER_SHARE_NAME;
    }
  } else {
    const hasConfigIp = CONFIG.PRINTER_IP && isIPv4(CONFIG.PRINTER_IP);
    if (CONFIG.PRINTER_MODE === 'LAN' || hasConfigIp) {
      isNetwork = true;
      ip = CONFIG.PRINTER_IP;
      port = CONFIG.PRINTER_PORT || 9100;
    } else {
      isNetwork = false;
      printerName = CONFIG.PRINTER_SHARE_NAME;
    }
  }

  if (isNetwork) {
    console.log(`[Agent] Sending ESC/POS print job via TCP socket to network printer at ${ip}:${port}`);
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.connect(port, ip, () => {
        socket.write(buffer, () => {
          socket.end();
        });
      });

      socket.on('close', () => {
        console.log(`[Agent] Print Job Details:
  - Mode: Network
  - Printer Name/IP: ${ip}
  - Port: ${port}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Success`);
        resolve();
      });

      socket.on('error', (err) => {
        socket.destroy();
        console.error(`[Agent] Print Job Details:
  - Mode: Network
  - Printer Name/IP: ${ip}
  - Port: ${port}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Failure (Reason: ${err.message})`);
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        const err = new Error(`Connection timed out: ${ip}:${port}`);
        console.error(`[Agent] Print Job Details:
  - Mode: Network
  - Printer Name/IP: ${ip}
  - Port: ${port}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Failure (Reason: ${err.message})`);
        reject(err);
      });
    });
  } else {
    // USB Spooler Print
    let portName = 'Unknown';
    try {
      const matchedPrinter = cachedPrinters.find(p => p.name && p.name.toLowerCase() === printerName.toLowerCase());
      if (matchedPrinter) {
        portName = matchedPrinter.port || 'USB001';
        printerName = matchedPrinter.name; // Keep exact casing
      } else {
        console.warn(`[Agent] Printer "${printerName}" not found in cached Windows printers. Refreshing cache in background and attempting to print...`);
        refreshPrintersCache().catch(err => {
          console.warn('[Agent] Background cache refresh error:', err.message);
        });
      }
    } catch (err) {
      console.warn(`[Agent] Failed to check cached Windows printers list: ${err.message}. Using default values...`);
    }

    console.log(`[Agent] Sending ESC/POS print job via Windows spooler to local printer: ${printerName}`);
    console.time("USBPrint");

    return new Promise((resolve, reject) => {
      const agentDir = isPackaged ? path.dirname(process.execPath) : __dirname;
      const exePath = path.join(agentDir, 'RawPrinterHelper.exe');
      const tempFilePath = path.join(agentDir, `temp_receipt_${Date.now()}.bin`);

      fs.writeFile(tempFilePath, buffer, (writeErr) => {
        if (writeErr) {
          console.timeEnd("USBPrint");
          const errMsg = 'Failed to write temp print file: ' + writeErr.message;
          console.error(`[Agent] Print Job Details:
  - Mode: USB
  - Printer Name: ${printerName}
  - Port: ${portName}
  - Bytes Sent: 0 bytes
  - Status: Failure (Reason: ${errMsg})`);
          return reject(new Error(errMsg));
        }

        // If pre-compiled exe exists, use it directly!
        if (fs.existsSync(exePath)) {
          const cmd = `"${exePath}" "${printerName}" "${tempFilePath}"`;
          exec(cmd, (execErr, stdout, stderr) => {
            console.timeEnd("USBPrint");
            fs.unlink(tempFilePath, () => { });

            if (execErr) {
              const reason = (stderr || execErr.message || stdout).trim();
              console.error(`[Agent] Print Job Details:
  - Mode: USB
  - Printer Name: ${printerName}
  - Port: ${portName}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Failure (Reason: ${reason})`);
              return reject(new Error(`USB print command failed: ${reason}`));
            }

            console.log(`[Agent] Print Job Details:
  - Mode: USB
  - Printer Name: ${printerName}
  - Port: ${portName}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Success`);
            resolve();
          });
        } else {
          // Fallback to PowerShell script compilation method
          const tempPsPath = path.join(agentDir, `temp_print_${Date.now()}.ps1`);
          const psScript = `
param (
    [string]$PrinterName,
    [string]$FilePath
)

$code = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            throw new Exception("OpenPrinter failed with error code: " + err);
        }

        DOCINFOA di = new DOCINFOA { pDocName = "Mejwani Print Agent Job", pDataType = "RAW" };
        if (!StartDocPrinter(hPrinter, 1, di)) {
            int err = Marshal.GetLastWin32Error();
            ClosePrinter(hPrinter);
            throw new Exception("StartDocPrinter failed with error code: " + err);
        }

        if (!StartPagePrinter(hPrinter)) {
            int err = Marshal.GetLastWin32Error();
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            throw new Exception("StartPagePrinter failed with error code: " + err);
        }

        IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pBytes, bytes.Length);
        int dwWritten;
        bool success = WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pBytes);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        if (!success) {
            int err = Marshal.GetLastWin32Error();
            throw new Exception("WritePrinter failed with error code: " + err);
        }
        return true;
    }
}
"@

try {
    if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
        Add-Type -TypeDefinition $code
    }
    if (-not (Test-Path $FilePath)) {
        Write-Error "File not found: $FilePath"
        exit 1
    }
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $result = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
    if ($result) {
        Write-Output "Success"
    } else {
        Write-Error "Failed to send bytes"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`;

          fs.writeFile(tempPsPath, psScript, 'utf8', (psWriteErr) => {
            if (psWriteErr) {
              console.timeEnd("USBPrint");
              fs.unlink(tempFilePath, () => { });
              const errMsg = 'Failed to write temp PowerShell script: ' + psWriteErr.message;
              console.error(`[Agent] Print Job Details:
  - Mode: USB
  - Printer Name: ${printerName}
  - Port: ${portName}
  - Bytes Sent: 0 bytes
  - Status: Failure (Reason: ${errMsg})`);
              return reject(new Error(errMsg));
            }

            const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsPath}" -PrinterName "${printerName}" -FilePath "${tempFilePath}"`;
            exec(cmd, (execErr, stdout, stderr) => {
              console.timeEnd("USBPrint");
              fs.unlink(tempFilePath, () => { });
              fs.unlink(tempPsPath, () => { });

              if (execErr) {
                const reason = (stderr || execErr.message || stdout).trim();
                console.error(`[Agent] Print Job Details:
  - Mode: USB
  - Printer Name: ${printerName}
  - Port: ${portName}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Failure (Reason: ${reason})`);
                return reject(new Error(`USB print command failed: ${reason}`));
              }

              console.log(`[Agent] Print Job Details:
  - Mode: USB
  - Printer Name: ${printerName}
  - Port: ${portName}
  - Bytes Sent: ${buffer.length} bytes
  - Status: Success`);
              resolve();
            });
          });
        }
      });
    });
  }
};

const startLocalServer = () => {
  const server = http.createServer(async (req, res) => {
    // Add CORS & Private Network Access (PNA) headers dynamically
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);

    // Direct local print endpoint
    if (req.method === 'POST' && parsedUrl.pathname === '/print') {
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', async () => {
        let jobIdStr = '';
        try {
          const job = JSON.parse(bodyData);
          if (job.id) {
            jobIdStr = String(job.id);
            if (completedJobIds.has(jobIdStr)) {
              console.log(`[Agent] Direct local /print: Job ID ${jobIdStr} already completed recently, skipping print.`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Printed locally successfully (already processed)' }));
              return;
            }
            if (acknowledgedJobIds.has(jobIdStr)) {
              console.log(`[Agent] Direct local /print: Job ID ${jobIdStr} already acknowledged, skipping print.`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Printed locally successfully (already acknowledged)' }));
              return;
            }
            if (activeJobIds.has(jobIdStr)) {
              console.log(`[Agent] Direct local /print: Job ID ${jobIdStr} is already processing, skipping print.`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Printed locally successfully (already processing)' }));
              return;
            }
            activeJobIds.add(jobIdStr);
          }

          if (job.job_type === 'KOT') {
            console.log('[KOT] Direct print called');
          }

          let payloadJson = job.payload;
          
          if (job.job_type === 'BILL') {
            const rawOrderId = payloadJson?.orderId || '';
            const orderIdVal = rawOrderId.replace(/\D/g, '') || 'N/A';
            const billId = rawOrderId.startsWith('ORD-') ? rawOrderId.replace('ORD-', 'INV-') : (orderIdVal !== 'N/A' ? `INV-${orderIdVal}` : 'N/A');
            console.log(`[Agent] Received direct local print request:
  - BILL_ID: ${billId}
  - ORDER_ID: ${orderIdVal}
  - PRINT_JOB_ID: ${job.id || 'N/A'}`);
          } else {
            console.log(`[Agent] Received direct local print request. Type: ${job.job_type}...`);
          }
          let buffer;

          if (job.job_type === 'BILL') {
            buffer = compileBillPayload(payloadJson);
          } else if (job.job_type === 'KOT') {
            buffer = compileKOTPayload(payloadJson);
          } else if (job.job_type === 'TEST') {
            buffer = compileTestPayload(payloadJson);
          } else {
            throw new Error(`Unsupported job type: ${job.job_type}`);
          }

          let target = null;
          if (localPrinterConfig) {
            if (job.job_type === 'BILL') {
              target = localPrinterConfig.bill;
            } else if (job.job_type === 'KOT') {
              target = localPrinterConfig.kot;
            } else if (job.job_type === 'TEST') {
              target = localPrinterConfig.bill || localPrinterConfig.kot;
            }
          }

          if (!target || !target.name) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: `Printer is not configured for ${job.job_type}.`, code: 'PRINTER_NOT_CONFIGURED' }));
            return;
          }

          const isNet = target.type === 'network' || isIPv4(target.target) || isIPv4(target.name) || isIPv4(target.ip);
          if (isNet) {
            let ip = CONFIG.PRINTER_IP;
            let port = CONFIG.PRINTER_PORT || 9100;
            let rawTarget = target.ip || target.target || target.name;
            if (typeof rawTarget === 'string') {
              const parts = rawTarget.split(':');
              ip = parts[0].trim();
              if (parts[1]) port = parseInt(parts[1].trim(), 10) || 9100;
              else if (target.port) port = target.port;
            }
            const online = await isPrinterReachable(ip, port);
            if (!online) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Printer is offline. Please check it.', code: 'PRINTER_OFFLINE' }));
              return;
            }
          }

          await sendToLocalPrinter(buffer, target);
          console.log('[Agent] Direct local print job completed successfully.');

          if (job.id) {
            addCompletedJobId(job.id);
            if (token) {
              try {
                console.log('[TRACE] Print Agent sending ACK');
                await makeRequest('POST', '/api/print-agent/ack', {
                  jobId: job.id,
                  status: 'COMPLETED',
                  printed_by_agent: CONFIG.USERNAME
                }, token);
                console.log(`[DEBUG] ACK sent for jobId: ${job.id}`);
                acknowledgedJobIds.add(jobIdStr);
              } catch (ackErr) {
                console.error(`[Agent] Failed to send ACK for direct print job ${job.id}:`, ackErr.message);
              }
            } else {
              console.log(`[Agent] No token available to send ACK for direct print job ${job.id}`);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Printed locally successfully' }));
        } catch (err) {
          console.error('[Agent] Direct local print failed:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        } finally {
          if (jobIdStr) {
            activeJobIds.delete(jobIdStr);
          }
        }
      });
      return;
    }

    if (parsedUrl.pathname === '/printers') {
      try {
        const printers = await discoverPrinters();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, printers }));
      } catch (err) {
        console.error('[Agent] Discover printers error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    } else if (parsedUrl.pathname === '/trigger-poll') {
      console.log('[KOT] Trigger poll called');
      console.log('[Agent] Received trigger-poll request from local client, polling immediately...');
      pollJobs(); // trigger instant check
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Polling triggered' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Not Found' }));
    }
  });

  const PORT = 9111;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Agent] Local HTTP server listening on http://localhost:${PORT} for printer discovery`);
  });
};

// ==========================================
// 5. MAIN AGENT CORE LIFE CYCLE
// ==========================================
let token = null;

const login = async () => {
  try {
    console.log(`[Agent] Logging in to ${CONFIG.BACKEND_URL} as: ${CONFIG.USERNAME}...`);
    const res = await makeRequest('POST', '/api/admin/login', {
      username: CONFIG.USERNAME,
      password: CONFIG.PASSWORD,
    });

    if (res.status === 200 && res.body.success) {
      token = res.body.token;
      console.log('[Agent] Login successful. Authentication token acquired.');
      return true;
    } else {
      console.error('[Agent] Login failed:', res.body.message || 'Check username and password configuration.');
      return false;
    }
  } catch (err) {
    console.error('[Agent] Login connection error:', err.message);
    return false;
  }
};

const sendHeartbeat = async () => {
  if (!token) return;
  try {
    // Determine printer statuses
    const printerStatus = {};
    if (localPrinterConfig) {
      if (localPrinterConfig.kot) {
        const target = localPrinterConfig.kot;
        const isNet = target.type === 'network' || isIPv4(target.target) || isIPv4(target.name) || isIPv4(target.ip);
        if (isNet) {
          let ip = CONFIG.PRINTER_IP;
          let port = CONFIG.PRINTER_PORT || 9100;
          let rawTarget = target.ip || target.target || target.name;
          if (typeof rawTarget === 'string') {
            const parts = rawTarget.split(':');
            ip = parts[0].trim();
            if (parts[1]) port = parseInt(parts[1].trim(), 10) || 9100;
            else if (target.port) port = target.port;
          }
          const kotOnline = await isPrinterReachable(ip, port);
          printerStatus.kot = kotOnline ? 'ONLINE' : 'OFFLINE';
        } else {
          printerStatus.kot = 'ONLINE'; // Assume local USB is ONLINE
        }
      } else {
        const defaultOnline = await isPrinterReachable(CONFIG.PRINTER_IP, CONFIG.PRINTER_PORT || 9100);
        printerStatus.kot = defaultOnline ? 'ONLINE' : 'OFFLINE';
      }

      if (localPrinterConfig.bill) {
        const target = localPrinterConfig.bill;
        const isNet = target.type === 'network' || isIPv4(target.target) || isIPv4(target.name) || isIPv4(target.ip);
        if (isNet) {
          let ip = CONFIG.PRINTER_IP;
          let port = CONFIG.PRINTER_PORT || 9100;
          let rawTarget = target.ip || target.target || target.name;
          if (typeof rawTarget === 'string') {
            const parts = rawTarget.split(':');
            ip = parts[0].trim();
            if (parts[1]) port = parseInt(parts[1].trim(), 10) || 9100;
            else if (target.port) port = target.port;
          }
          const billOnline = await isPrinterReachable(ip, port);
          printerStatus.bill = billOnline ? 'ONLINE' : 'OFFLINE';
        } else {
          printerStatus.bill = 'ONLINE'; // Assume local USB is ONLINE
        }
      } else {
        const defaultOnline = await isPrinterReachable(CONFIG.PRINTER_IP, CONFIG.PRINTER_PORT || 9100);
        printerStatus.bill = defaultOnline ? 'ONLINE' : 'OFFLINE';
      }
    } else {
      const defaultOnline = await isPrinterReachable(CONFIG.PRINTER_IP, CONFIG.PRINTER_PORT || 9100);
      printerStatus.kot = defaultOnline ? 'ONLINE' : 'OFFLINE';
      printerStatus.bill = defaultOnline ? 'ONLINE' : 'OFFLINE';
    }

    const res = await makeRequest('POST', '/api/print-agent/heartbeat', {
      printerStatus: printerStatus,
      printerConfig: localPrinterConfig || { ip: CONFIG.PRINTER_IP, port: CONFIG.PRINTER_PORT },
      version: '1.0.0'
    }, token);

    if (res.status === 200 && res.body.success) {
      console.log(`[Agent] Heartbeat registered. Agent is ONLINE. KOT Status: ${printerStatus.kot}, Bill Status: ${printerStatus.bill}`);
      if (res.body.agent && res.body.agent.printer_config) {
        localPrinterConfig = typeof res.body.agent.printer_config === 'string'
          ? JSON.parse(res.body.agent.printer_config)
          : res.body.agent.printer_config;
      }
    } else {
      console.warn(`[Agent] Heartbeat rejected: ${res.body.message || 'Token expired'}`);
      if (res.status === 401) {
        await login();
      }
    }
  } catch (err) {
    console.error('[Agent] Heartbeat send failed:', err.message);
  }
};

const pollJobs = async () => {
  if (!token) return;
  try {
    console.time("FetchPendingJobs");
    const res = await makeRequest('GET', '/api/print-agent/poll', null, token);
    console.timeEnd("FetchPendingJobs");
    if (res.status === 200 && res.body.success) {
      const jobs = res.body.jobs || [];
      if (jobs.length > 0) {
        console.log(`[Agent] Found ${jobs.length} pending print job(s).`);
        for (const job of jobs) {
          await processJob(job);
        }
      }
    } else {
      if (res.status === 401) {
        await login();
      }
    }
  } catch (err) {
    console.timeEnd("FetchPendingJobs");
    console.error('[Agent] Polling error:', err.message);
  }
};

const processJob = async (job) => {
  if (!job.id) return;
  const jobIdStr = String(job.id);
  if (completedJobIds.has(jobIdStr)) {
    console.log(`[Agent] Job ID ${jobIdStr} already completed recently, skipping.`);
    return;
  }
  if (acknowledgedJobIds.has(jobIdStr)) {
    console.log(`[Agent] Job ID ${jobIdStr} already acknowledged, skipping.`);
    return;
  }
  if (activeJobIds.has(jobIdStr)) {
    console.log(`[Agent] Job ID ${jobIdStr} is already processing, skipping.`);
    return;
  }
  activeJobIds.add(jobIdStr);

  if (job.job_type === 'KOT') {
    console.log('[KOT] Poll picked job');
  }

  let payloadJson = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
  let orderId = 'N/A';
  let kotId = 'N/A';
  if (payloadJson) {
    kotId = payloadJson.orderId || 'N/A';
    orderId = payloadJson.orderIdVal || (payloadJson.orderId ? String(payloadJson.orderId).replace(/\D/g, '') : 'N/A');
  }
  const isParcelKOT = job.job_type === 'KOT' && payloadJson?.sectionName === 'PARCEL';
  if (isParcelKOT) {
    console.log(`[PARCEL] Job picked. PRINT_JOB_ID: ${job.id}, ORDER_ID: ${kotId}`);
  }

  console.time("PrintJobTotal");
  if (job.job_type === 'BILL') {
    const rawOrderId = payloadJson?.orderId || '';
    const orderIdVal = rawOrderId.replace(/\D/g, '') || 'N/A';
    const billId = rawOrderId.startsWith('ORD-') ? rawOrderId.replace('ORD-', 'INV-') : (orderIdVal !== 'N/A' ? `INV-${orderIdVal}` : 'N/A');
    console.log(`[Agent] Processing Print Job:
  - BILL_ID: ${billId}
  - ORDER_ID: ${orderIdVal}
  - PRINT_JOB_ID: ${job.id}
  - Job Type: ${job.job_type}`);
  } else {
    console.log(`[Agent] Processing Print Job:
  - ORDER_ID: ${orderId}
  - KOT_ID: ${kotId}
  - PRINT_JOB_ID: ${job.id}
  - Job Type: ${job.job_type}`);
  }

  console.log(`[Agent] Printing job ID: ${job.id}, Type: ${job.job_type}...`);
  try {
    let buffer;

    if (job.job_type === 'BILL') {
      buffer = compileBillPayload(payloadJson);
    } else if (job.job_type === 'KOT') {
      buffer = compileKOTPayload(payloadJson);
    } else if (job.job_type === 'TEST') {
      buffer = compileTestPayload(payloadJson);
    } else {
      throw new Error(`Unsupported job type: ${job.job_type}`);
    }

    let target = null;
    if (localPrinterConfig) {
      if (job.job_type === 'BILL') {
        target = localPrinterConfig.bill;
      } else if (job.job_type === 'KOT') {
        target = localPrinterConfig.kot;
      } else if (job.job_type === 'TEST') {
        target = localPrinterConfig.bill || localPrinterConfig.kot;
      }
    }

    let targetDesc = '';
    if (target) {
      const isNet = target.type === 'network' || isIPv4(target.target) || isIPv4(target.name) || isIPv4(target.ip);
      if (isNet) {
        let ip = CONFIG.PRINTER_IP;
        let port = CONFIG.PRINTER_PORT || 9100;
        let rawTarget = target.ip || target.target || target.name;
        if (typeof rawTarget === 'string') {
          const parts = rawTarget.split(':');
          ip = parts[0].trim();
          if (parts[1]) port = parseInt(parts[1].trim(), 10) || 9100;
          else if (target.port) port = target.port;
        }
        targetDesc = `Network:${ip}:${port}`;
      } else {
        targetDesc = `USB:${target.name || target.target}`;
      }
    } else {
      const isNet = CONFIG.PRINTER_MODE === 'LAN' || isIPv4(CONFIG.PRINTER_IP);
      targetDesc = isNet ? `Network:${CONFIG.PRINTER_IP}:${CONFIG.PRINTER_PORT || 9100}` : `USB:${CONFIG.PRINTER_SHARE_NAME}`;
    }

    console.log(`[Agent] Dispatching raw ESC/POS payload (${buffer.length} bytes) to ${targetDesc}...`);
    console.log(`[Agent] Printing Started At: ${new Date().toISOString()}`);
    await sendToLocalPrinter(buffer, target);
    addCompletedJobId(jobIdStr);
    if (isParcelKOT) {
      console.log(`[PARCEL] Print completed. PRINT_JOB_ID: ${job.id}`);
    }
    console.log(`[Agent] Printing Completed At: ${new Date().toISOString()}`);
    console.timeEnd("PrintJobTotal");

    // Send ack back to server
    console.log('[TRACE] Print Agent sending ACK');
    await makeRequest('POST', '/api/print-agent/ack', {
      jobId: job.id,
      status: 'COMPLETED',
      printed_by_agent: CONFIG.USERNAME
    }, token);
    console.log(`[DEBUG] ACK sent for jobId: ${job.id}`);
    acknowledgedJobIds.add(jobIdStr);
    if (isParcelKOT) {
      console.log(`[PARCEL] ACK sent. PRINT_JOB_ID: ${job.id}`);
    }
    console.log('[Agent] Job acknowledged to server.');
  } catch (err) {
    console.timeEnd("PrintJobTotal");
    console.error(`[Agent] Failed to print job ${job.id}:`, err.message);
    try {
      await makeRequest('POST', '/api/print-agent/ack', {
        jobId: job.id,
        status: 'FAILED',
        errorMessage: err.message
      }, token);
    } catch (ackErr) {
      console.error('[Agent] Failed to send failure ack:', ackErr.message);
    }
  } finally {
    activeJobIds.delete(jobIdStr);
  }
};

const start = async () => {
  console.log('==================================================');
  console.log('          MEJWANI LOCAL PRINT AGENT v1.0          ');
  console.log('==================================================');
  console.log(`Local Printer IP: ${CONFIG.PRINTER_IP}:${CONFIG.PRINTER_PORT}`);
  console.log(`Cloud Server URL: ${CONFIG.BACKEND_URL}`);
  console.log('==================================================');

  // Compile C# print helper once at startup if needed
  await ensureRawPrinterHelperCompiled();

  // Populate/Refresh printer cache at startup
  await refreshPrintersCache();
  const loggedIn = await login();
  if (!loggedIn) {
    console.error('[Agent] Initial connection/auth failed. Retrying in 10 seconds...');
    setTimeout(start, 10000);
    return;
  }

  await sendHeartbeat();
  startLocalServer();

  // Heartbeat every 15 seconds
  setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL_MS);

  // Poll print jobs using recursive timeout to avoid concurrent runs
  const runPollingLoop = async () => {
    try {
      await pollJobs();
    } catch (err) {
      console.error('[Agent] Polling loop error:', err.message);
    }
    setTimeout(runPollingLoop, CONFIG.POLL_INTERVAL_MS);
  };

  runPollingLoop();

  console.log('[Agent] Listening for print jobs... Do not close this terminal.');
};

start();
