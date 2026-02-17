'use strict';

const ALL_CAPABILITIES = [
  'measure_temperature', 'measure_humidity', 'measure_co2',
  'measure_pm25', 'measure_etoh', 'measure_iaq', 'measure_tvoc', 'measure_co',
];

module.exports = {
  async getZoneClimate({ homey, query }) {
    const { zoneid, includeChild } = query;
    return homey.app.service.getZoneClimate(zoneid, includeChild, ALL_CAPABILITIES);
  },
};
