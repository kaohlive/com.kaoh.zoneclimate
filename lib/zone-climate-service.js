'use strict';

const { HomeyAPI } = require('homey-api');

const ALL_CAPABILITIES = [
  'measure_temperature', 'measure_humidity', 'measure_co2',
  'measure_pm25', 'measure_etoh', 'measure_iaq', 'measure_tvoc', 'measure_co',
];

class ZoneClimateService {

  constructor(homey) {
    this._homey = homey;
    this._api = null;
    // Warm in-memory store, kept up to date by capability subscriptions.
    // deviceId -> { name, zone, capabilities: [{ id, value, units }] }
    this._devices = new Map();
    // zoneId -> { id, name, parent }
    this._zones = new Map();
    // Retain { instance, source } so homey-api does not GC the CapabilityInstance
    // (a destroyed/collected instance silently stops delivering change events).
    this._subs = [];
    this._initialized = false;
  }

  /**
   * Create a single long-lived app API client and build the warm store by
   * subscribing to the climate capabilities of all relevant devices. Replaces
   * the old per-refresh forCurrentHomey() client that was allocated/destroyed
   * on a timer (~60MB churn). Call once from app.onInit.
   */
  async init() {
    if (this._initialized) return;
    this._api = await HomeyAPI.createAppAPI({ homey: this._homey });
    await this._buildStore();
    this._initialized = true;
  }

  /** Tear down all subscriptions and the API client. Call from app.onUninit. */
  teardown() {
    for (const sub of this._subs) {
      try {
        if (sub.instance && sub.instance.destroy) sub.instance.destroy();
      } catch (err) {
        // best-effort cleanup
      }
    }
    this._subs = [];
    this._devices.clear();
    this._zones.clear();
    if (this._api && this._api.destroy) {
      try { this._api.destroy(); } catch (err) { /* best-effort */ }
    }
    this._api = null;
    this._initialized = false;
  }

  async _buildStore() {
    const rawZones = Object.values(await this._api.zones.getZones());
    this._zones.clear();
    for (const z of rawZones) {
      this._zones.set(z.id, { id: z.id, name: z.name, parent: z.parent });
    }

    const rawDevices = Object.values(await this._api.devices.getDevices());
    for (const device of rawDevices) {
      this._addDevice(device);
    }
  }

  /**
   * Add a device to the store if it is a non-excluded climate device, and
   * subscribe to each of its climate capabilities. Seeds current values from
   * the snapshot (change listeners only fire on change, so without seeding the
   * store would stay empty for stable values).
   */
  _addDevice(device) {
    if (!device || device.settings && device.settings.climate_exclude === true) return;
    const climateCaps = ALL_CAPABILITIES.filter(cap => device.capabilities.includes(cap));
    if (climateCaps.length === 0) return;

    const entry = { name: device.name, zone: device.zone, capabilities: [] };

    for (const cap of climateCaps) {
      // Seed from snapshot. Units are only delivered in the snapshot, not in
      // change events, so capture them here and preserve them across updates.
      const obj = device.capabilitiesObj && device.capabilitiesObj[cap];
      entry.capabilities.push({
        id: cap,
        value: obj ? obj.value : null,
        units: obj ? obj.units : null,
      });

      try {
        const instance = device.makeCapabilityInstance(cap, (value) => {
          this._onCapValue(device.id, cap, value);
        });
        this._subs.push({ instance, source: device });
      } catch (err) {
        this._homey.error(`Subscribe ${device.name}/${cap} failed: ${err.message}`);
      }
    }

    this._devices.set(device.id, entry);
  }

  /** Update a single capability value in the warm store on a change event. */
  _onCapValue(deviceId, capId, value) {
    const entry = this._devices.get(deviceId);
    if (!entry) return;
    const cap = entry.capabilities.find(c => c.id === capId);
    if (cap) {
      cap.value = value;
    } else {
      entry.capabilities.push({ id: capId, value, units: null });
    }
  }

  async getZones() {
    return Array.from(this._zones.values());
  }

  async getDevices() {
    return Array.from(this._devices.values());
  }

  collectZones(zones, zoneId, traverse) {
    let collected = [zoneId];
    if (!traverse) return collected;
    const subZones = zones.filter(z => z.parent === zoneId);
    for (const sub of subZones) {
      collected = collected.concat(this.collectZones(zones, sub.id, traverse));
    }
    return collected;
  }

  createMeasurements(measurementId, devices) {
    const measurementDevices = devices.filter(
      d => d.capabilities.some(cap => cap.id === measurementId),
    );
    let units = null;
    if (measurementDevices.length > 0) {
      const total = measurementDevices.reduce((sum, device) => {
        const measurement = device.capabilities.find(cap => cap.id === measurementId);
        units = measurement.units;
        return sum + (measurement.value || 0);
      }, 0);
      return { available: true, average: total / measurementDevices.length, units };
    }
    return { available: false, average: 0, units };
  }

  async getZoneClimate(zoneId, includeChild, filterCapabilities) {
    const allDevices = await this.getDevices();
    const allZones = await this.getZones();
    const relevantZones = this.collectZones(allZones, zoneId, includeChild);

    // Devices are already pre-filtered for climate capabilities and exclusion
    const zoneDevices = allDevices.filter(d => relevantZones.includes(d.zone));

    const result = {};
    filterCapabilities.forEach(cap => {
      result[cap] = this.createMeasurements(cap, zoneDevices);
    });
    return result;
  }

  async getZonesAutocomplete(query) {
    const zones = await this.getZones();
    return zones
      .map(z => ({ name: z.name, id: z.id }))
      .filter(z => z.name.toLowerCase().includes(query.toLowerCase()));
  }

  convertToCelsius(value, units) {
    if (units && units.endsWith('F')) {
      return (value - 32) * 5 / 9;
    }
    return value;
  }

  classifyTemperatureComfort(tempCelsius) {
    if (tempCelsius < 10) return 'very cold';
    if (tempCelsius < 15) return 'cold';
    if (tempCelsius < 18.5) return 'chilly';
    if (tempCelsius < 22) return 'comfortable';
    if (tempCelsius < 28) return 'warm';
    return 'hot';
  }

  classifyHumidityComfort(humidityPct) {
    if (humidityPct < 30) return 'dry';
    if (humidityPct < 65) return 'comfortable';
    if (humidityPct < 80) return 'humid';
    return 'wet';
  }

  classifyComfort(tempCelsius, humidityPct) {
    const temp = this.classifyTemperatureComfort(tempCelsius);
    const hum = this.classifyHumidityComfort(humidityPct);
    // 'comfortable' is the neutral band for each axis and is omitted from the combined label
    const tempLabel = temp === 'comfortable' ? '' : temp;
    const humLabel = hum === 'comfortable' ? '' : hum;
    const combined = [tempLabel, humLabel].filter(Boolean).join(' ');
    return combined || 'comfortable';
  }

  classifyAirQuality(iaqValue) {
    if (iaqValue < 50) return 'great';
    if (iaqValue < 100) return 'good';
    if (iaqValue < 150) return 'fair';
    if (iaqValue < 250) return 'poor';
    return 'bad';
  }

}

module.exports = { ZoneClimateService, ALL_CAPABILITIES };
