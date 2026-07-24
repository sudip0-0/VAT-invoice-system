const fs = require("node:fs");
const path = require("node:path");

let logDir = null;
let logFile = null;

function initLogger(userDataPath) {
  logDir = path.join(userDataPath, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, "desktop.log");
}

function getLogDir() {
  return logDir;
}

function redact(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.replace(/("password"\s*:\s*")[^"]*(")/gi, "$1***$2");
  }
  if (typeof value === "object") {
    const clone = Array.isArray(value) ? [...value] : { ...value };
    for (const key of Object.keys(clone)) {
      if (/password/i.test(key)) {
        clone[key] = "***";
      } else {
        clone[key] = redact(clone[key]);
      }
    }
    return clone;
  }
  return value;
}

function write(level, message, meta) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    meta: meta === undefined ? undefined : redact(meta),
  });
  if (logFile) {
    try {
      fs.appendFileSync(logFile, `${line}\n`, "utf8");
    } catch {
      // ignore disk errors in logger
    }
  }
  if (level === "error") {
    console.error(`[desktop] ${message}`, meta ? redact(meta) : "");
  }
}

const logger = {
  init: initLogger,
  getLogDir,
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};

module.exports = { logger };
