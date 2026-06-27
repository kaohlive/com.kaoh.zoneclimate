'use strict';

const ALL_CAPABILITIES = [
  'measure_temperature', 'measure_humidity', 'measure_co2',
  'measure_pm25', 'measure_etoh', 'measure_iaq', 'measure_tvoc', 'measure_co',
];

module.exports = {
  async getZoneClimate({ homey, query }) {
    const { zoneid, includeChild } = query;
    const service = homey.app.service;
    const data = await service.getZoneClimate(zoneid, includeChild, ALL_CAPABILITIES);
    // Server-computed comfort labels so the widget never duplicates thresholds.
    return { ...data, classification: service.classifyClimate(data) };
  },
};
