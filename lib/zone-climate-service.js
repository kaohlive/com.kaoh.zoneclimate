'use strict';

const { HomeyAPI } = require('athom-api');

const ALL_CAPABILITIES = [
  'measure_temperature', 'measure_humidity', 'measure_co2',
  'measure_pm25', 'measure_etoh', 'measure_iaq', 'measure_tvoc', 'measure_co',
];

class ZoneClimateService {

  constructor(homey) {
    this._homey = homey;
    this._api = null;
    this._cache = {
      devices: null,
      zones: null,
      timestamp: 0,
    };
    this._cacheTTL = 30000; // 30 seconds
  }

  async getApi() {
    if (!this._api) {
      this._api = await HomeyAPI.forCurrentHomey(this._homey);
    }
    return this._api;
  }

  _isCacheValid() {
    return (Date.now() - this._cache.timestamp) < this._cacheTTL;
  }

  async _refreshCache() {
    if (this._isCacheValid()) return;
    const api = await this.getApi();
    this._cache.devices = Object.values(await api.devices.getDevices());
    this._cache.zones = Object.values(await api.zones.getZones());
    this._cache.timestamp = Date.now();
  }

  async getZones() {
    await this._refreshCache();
    return this._cache.zones;
  }

  async getDevices() {
    await this._refreshCache();
    return this._cache.devices;
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

    let zoneDevices = allDevices.filter(d => relevantZones.includes(d.zone));
    zoneDevices = zoneDevices.filter(d => d.settings.climate_exclude === false);

    const filteredDevices = zoneDevices
      .filter(d => filterCapabilities.some(cap => d.capabilities.includes(cap)))
      .map(d => ({
        name: d.name,
        capabilities: Object.values(d.capabilitiesObj),
      }));

    const result = {};
    filterCapabilities.forEach(cap => {
      result[cap] = this.createMeasurements(cap, filteredDevices);
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

  classifyComfort(tempCelsius, humidityPct) {
    let tempLabel = '';
    if (tempCelsius < 10) tempLabel = 'very cold';
    else if (tempCelsius < 15) tempLabel = 'cold';
    else if (tempCelsius < 18.5) tempLabel = 'chilly';
    else if (tempCelsius < 22) tempLabel = '';
    else if (tempCelsius < 28) tempLabel = 'warm';
    else tempLabel = 'hot';

    let humLabel = '';
    if (humidityPct < 30) humLabel = 'dry';
    else if (humidityPct < 65) humLabel = '';
    else if (humidityPct < 80) humLabel = 'humid';
    else humLabel = 'wet';

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
