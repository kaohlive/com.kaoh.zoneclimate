'use strict';

const Homey = require('homey');
const { ZoneClimateService, ALL_CAPABILITIES } = require('./lib/zone-climate-service');

module.exports = class ZoneClimate extends Homey.App {

  async onInit() {
    this.log('Zone climate app has been initialized');

    this.service = new ZoneClimateService(this.homey);

    this._registerWidgetAutocomplete('zone-climate', ['zone']);
    this._registerWidgetAutocomplete('zone-climate-compact', ['zone', 'zone2']);
    this._registerFlowCards();
  }

  _registerWidgetAutocomplete(widgetId, settingIds) {
    try {
      const widget = this.homey.dashboards.getWidget(widgetId);
      for (const settingId of settingIds) {
        widget.registerSettingAutocompleteListener(settingId, async (query) => {
          return this.service.getZonesAutocomplete(query);
        });
      }
    } catch (err) {
      this.log(`Widget ${widgetId} autocomplete unavailable: ${err.message}`);
    }
  }

  _registerFlowCards() {
    // --- Trigger cards ---
    this._triggerTempChanged = this.homey.flow.getTriggerCard('zone-temperature-changed');
    this._triggerTempChanged.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerTempChanged.registerRunListener(async (args, state) => {
      return args.zone.id === state.zone.id && Boolean(args.includeChild) === Boolean(state.includeChild);
    });

    this._triggerHumChanged = this.homey.flow.getTriggerCard('zone-humidity-changed');
    this._triggerHumChanged.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerHumChanged.registerRunListener(async (args, state) => {
      return args.zone.id === state.zone.id && Boolean(args.includeChild) === Boolean(state.includeChild);
    });

    this._triggerComfortChanged = this.homey.flow.getTriggerCard('zone-comfort-changed');
    this._triggerComfortChanged.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerComfortChanged.registerRunListener(async (args, state) => {
      return args.zone.id === state.zone.id && Boolean(args.includeChild) === Boolean(state.includeChild);
    });

    this._triggerAirQualChanged = this.homey.flow.getTriggerCard('zone-air-quality-changed');
    this._triggerAirQualChanged.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerAirQualChanged.registerRunListener(async (args, state) => {
      return args.zone.id === state.zone.id && Boolean(args.includeChild) === Boolean(state.includeChild);
    });

    this._triggerCo2Changed = this.homey.flow.getTriggerCard('zone-co2-changed');
    this._triggerCo2Changed.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerCo2Changed.registerRunListener(async (args, state) => {
      return args.zone.id === state.zone.id && Boolean(args.includeChild) === Boolean(state.includeChild);
    });

    // --- Threshold-crossing trigger cards ---
    this._triggerTempCrossed = this.homey.flow.getTriggerCard('zone-temperature-crossed');
    this._triggerTempCrossed.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerTempCrossed.registerRunListener(async (args, state) => {
      if (args.zone.id !== state.zone.id || Boolean(args.includeChild) !== Boolean(state.includeChild)) return false;
      if (args.direction === 'above') return state.previous <= args.threshold && state.current > args.threshold;
      return state.previous >= args.threshold && state.current < args.threshold;
    });

    this._triggerHumCrossed = this.homey.flow.getTriggerCard('zone-humidity-crossed');
    this._triggerHumCrossed.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerHumCrossed.registerRunListener(async (args, state) => {
      if (args.zone.id !== state.zone.id || Boolean(args.includeChild) !== Boolean(state.includeChild)) return false;
      if (args.direction === 'above') return state.previous <= args.threshold && state.current > args.threshold;
      return state.previous >= args.threshold && state.current < args.threshold;
    });

    this._triggerCo2Crossed = this.homey.flow.getTriggerCard('zone-co2-crossed');
    this._triggerCo2Crossed.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    this._triggerCo2Crossed.registerRunListener(async (args, state) => {
      if (args.zone.id !== state.zone.id || Boolean(args.includeChild) !== Boolean(state.includeChild)) return false;
      if (args.direction === 'above') return state.previous <= args.threshold && state.current > args.threshold;
      return state.previous >= args.threshold && state.current < args.threshold;
    });

    // --- Condition cards ---
    const condTempAbove = this.homey.flow.getConditionCard('zone-temperature-above');
    condTempAbove.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    condTempAbove.registerRunListener(async (args) => {
      const data = await this.service.getZoneClimate(args.zone.id, args.includeChild, ['measure_temperature']);
      if (!data.measure_temperature.available) return false;
      const temp = this.service.convertToCelsius(data.measure_temperature.average, data.measure_temperature.units);
      return temp > args.threshold;
    });

    const condHumAbove = this.homey.flow.getConditionCard('zone-humidity-above');
    condHumAbove.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    condHumAbove.registerRunListener(async (args) => {
      const data = await this.service.getZoneClimate(args.zone.id, args.includeChild, ['measure_humidity']);
      if (!data.measure_humidity.available) return false;
      return data.measure_humidity.average > args.threshold;
    });

    const condCo2Above = this.homey.flow.getConditionCard('zone-co2-above');
    condCo2Above.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    condCo2Above.registerRunListener(async (args) => {
      const data = await this.service.getZoneClimate(args.zone.id, args.includeChild, ['measure_co2']);
      if (!data.measure_co2.available) return false;
      return data.measure_co2.average > args.threshold;
    });

    const condComfortIs = this.homey.flow.getConditionCard('zone-comfort-is');
    condComfortIs.registerArgumentAutocompleteListener('zone', async (query) => {
      return this.service.getZonesAutocomplete(query);
    });
    condComfortIs.registerRunListener(async (args) => {
      const data = await this.service.getZoneClimate(args.zone.id, args.includeChild, ['measure_temperature', 'measure_humidity']);
      if (!data.measure_temperature.available || !data.measure_humidity.available) return false;
      const tempC = this.service.convertToCelsius(data.measure_temperature.average, data.measure_temperature.units);
      const comfort = this.service.classifyComfort(tempC, data.measure_humidity.average);
      return comfort === args.comfort;
    });

    // --- Trigger polling ---
    this._previousState = new Map();
    // Run once after a short delay to capture baseline state
    this.homey.setTimeout(() => {
      this._evaluateTriggers().catch(err => this.error('Trigger evaluation failed:', err.message));
    }, 10000);
    // Then poll every 60 seconds
    this._pollInterval = this.homey.setInterval(() => {
      this._evaluateTriggers().catch(err => this.error('Trigger evaluation failed:', err.message));
    }, 60000);
  }

  async _evaluateTriggers() {
    const zones = await this.service.getZones();

    for (const zone of zones) {
      for (const includeChild of [true, false]) {
        try {
          const data = await this.service.getZoneClimate(zone.id, includeChild, ALL_CAPABILITIES);
          const stateKey = `${zone.id}:${includeChild}`;
          const prev = this._previousState.get(stateKey) || {};

          // Temperature triggers
          if (data.measure_temperature.available) {
            const tempC = this.service.convertToCelsius(data.measure_temperature.average, data.measure_temperature.units);
            if (prev.temperature === undefined || Math.abs(tempC - prev.temperature) > 0.5) {
              this._triggerTempChanged.trigger({
                temperature: Math.round(data.measure_temperature.average * 10) / 10,
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild }).catch(err => this.error(err));
            }
            if (prev.temperature !== undefined) {
              this._triggerTempCrossed.trigger({
                temperature: Math.round(tempC * 10) / 10,
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild, previous: prev.temperature, current: tempC }).catch(err => this.error(err));
            }
            prev.temperature = tempC;
          }

          // Humidity triggers
          if (data.measure_humidity.available) {
            const hum = data.measure_humidity.average;
            if (prev.humidity === undefined || Math.abs(hum - prev.humidity) > 2) {
              this._triggerHumChanged.trigger({
                humidity: Math.round(hum),
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild }).catch(err => this.error(err));
            }
            if (prev.humidity !== undefined) {
              this._triggerHumCrossed.trigger({
                humidity: Math.round(hum),
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild, previous: prev.humidity, current: hum }).catch(err => this.error(err));
            }
            prev.humidity = hum;
          }

          // Comfort trigger
          if (data.measure_temperature.available && data.measure_humidity.available) {
            const tempC = this.service.convertToCelsius(data.measure_temperature.average, data.measure_temperature.units);
            const comfort = this.service.classifyComfort(tempC, data.measure_humidity.average);
            if (prev.comfort !== undefined && prev.comfort !== comfort) {
              this._triggerComfortChanged.trigger({
                comfort,
                temperature: Math.round(data.measure_temperature.average * 10) / 10,
                humidity: Math.round(data.measure_humidity.average),
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild }).catch(err => this.error(err));
            }
            prev.comfort = comfort;
          }

          // Air quality trigger
          if (data.measure_iaq.available) {
            const aqLabel = this.service.classifyAirQuality(data.measure_iaq.average);
            if (prev.airQuality !== undefined && prev.airQuality !== aqLabel) {
              this._triggerAirQualChanged.trigger({
                air_quality: aqLabel,
                iaq_value: Math.round(data.measure_iaq.average),
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild }).catch(err => this.error(err));
            }
            prev.airQuality = aqLabel;
          }

          // CO2 triggers
          if (data.measure_co2.available) {
            const co2 = data.measure_co2.average;
            if (prev.co2 === undefined || Math.abs(co2 - prev.co2) > 25) {
              this._triggerCo2Changed.trigger({
                co2: Math.round(co2),
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild }).catch(err => this.error(err));
            }
            if (prev.co2 !== undefined) {
              this._triggerCo2Crossed.trigger({
                co2: Math.round(co2),
                zone_name: zone.name,
              }, { zone: { id: zone.id, name: zone.name }, includeChild, previous: prev.co2, current: co2 }).catch(err => this.error(err));
            }
            prev.co2 = co2;
          }

          this._previousState.set(stateKey, prev);
        } catch (err) {
          this.error(`Trigger eval failed for zone ${zone.name}: ${err.message}`);
        }
      }
    }
  }

};
