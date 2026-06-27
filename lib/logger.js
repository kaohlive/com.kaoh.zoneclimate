'use strict';

/**
 * Zone Climate logger.
 *
 * Pattern (ported from com.kaoh.smartems lib/logger.ts, simplified for JS):
 * a ring-buffer in homey.settings + realtime push to the settings page.
 *
 * Only one buffer here: climate events are sparse (trigger fires, reconcile,
 * subscribe, errors) so a single buffer trimmed to ~1 hour is plenty — no need
 * for the separate tick/slim buffers smartems keeps. DEBUG is streamed live but
 * never persisted. Entries older than 1 hour are dropped on every write, with a
 * hard count cap as a safety net.
 *
 * Usage:
 *   this.logger = new Logger(this.homey, 'ZoneClimate');
 *   this.logger.info('app started');
 *   const child = this.logger.child('service');
 *   child.info('subscribed', { type: 'subscribe', count: 4 });
 */

const SETTINGS_KEY = 'debugLog';
const REALTIME_EVENT = 'log';
const REALTIME_CLEAR = 'log:clear';

const MAX_AGE_MS = 60 * 60 * 1000; // keep ~1 hour of history
const MAX_BUFFER = 500;            // hard safety cap on entry count

class Logger {

  constructor(homey, source = 'ZoneClimate') {
    this._homey = homey;
    this.source = source;
  }

  /** Sub-logger with a different source tag, sharing the same buffer. */
  child(source) {
    return new Logger(this._homey, source);
  }

  debug(message, data) { this._write('DEBUG', message, data); }
  info(message, data) { this._write('INFO', message, data); }
  warn(message, data) { this._write('WARN', message, data); }
  error(message, data) { this._write('ERROR', message, data); }

  /** Return the persisted buffer (used by the settings page on load). */
  getEntries() {
    return this._homey.settings.get(SETTINGS_KEY) || [];
  }

  /** Empty the buffer — settings page Clear button. */
  clear() {
    this._homey.settings.set(SETTINGS_KEY, []);
    try { this._homey.api.realtime(REALTIME_CLEAR, null); } catch (err) { /* ignore */ }
  }

  _write(level, message, data) {
    const now = new Date();
    const ts = now.toISOString().slice(0, 19) + 'Z';
    const entry = { ts, level, source: this.source, message };

    // Lift an optional short 'type' tag out of data for filtering in the viewer.
    if (data && typeof data === 'object' && 'type' in data && typeof data.type === 'string') {
      entry.type = data.type;
    }
    if (data !== undefined) entry.data = sanitize(data);

    // Console (visible in `homey app run`)
    if (entry.data !== undefined) {
      // eslint-disable-next-line no-console
      console.log(`${ts} [${this.source}] [${level}] ${message}`, entry.data);
    } else {
      // eslint-disable-next-line no-console
      console.log(`${ts} [${this.source}] [${level}] ${message}`);
    }

    // Persist everything except DEBUG, trimmed by age + count.
    if (level !== 'DEBUG') {
      this._append(entry, now.getTime());
    }

    // Realtime push (all levels — live feed shows DEBUG too)
    try {
      this._homey.api.realtime(REALTIME_EVENT, entry);
    } catch (err) {
      // api.realtime can fail before init — ignore
    }
  }

  _append(entry, nowMs) {
    const buf = this._homey.settings.get(SETTINGS_KEY) || [];
    buf.push(entry);
    const cutoff = nowMs - MAX_AGE_MS;
    let trimmed = buf.filter(e => Date.parse(e.ts) >= cutoff);
    while (trimmed.length > MAX_BUFFER) trimmed.shift();
    try {
      this._homey.settings.set(SETTINGS_KEY, trimmed);
    } catch (err) {
      // never log recursively — ignore
    }
  }

}

function sanitize(data) {
  if (data instanceof Error) {
    return { message: data.message, stack: data.stack, name: data.name };
  }
  try {
    JSON.stringify(data);
    return data;
  } catch (err) {
    return String(data);
  }
}

module.exports = { Logger };
