'use strict';

const COMPACT_CAPABILITIES = ['measure_temperature', 'measure_humidity'];

module.exports = {
  async getZoneClimate({ homey, query }) {
    const { zoneid, includeChild } = query;
    return homey.app.service.getZoneClimate(zoneid, includeChild, COMPACT_CAPABILITIES);
  },
};
