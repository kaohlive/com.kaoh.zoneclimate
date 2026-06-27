'use strict';

const COMPACT_CAPABILITIES = ['measure_temperature', 'measure_humidity'];

module.exports = {
  async getZoneClimate({ homey, query }) {
    const { zoneid, includeChild } = query;
    const service = homey.app.service;
    const data = await service.getZoneClimate(zoneid, includeChild, COMPACT_CAPABILITIES);
    // Server-computed comfort labels so the widget never duplicates thresholds.
    return { ...data, classification: service.classifyClimate(data) };
  },
};
