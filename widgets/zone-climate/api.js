'use strict';

const { HomeyAPI } = require('athom-api');

function createmeasurements(measurementid, devices)
{
  let measurementDevices = devices.filter(device => device.capabilities.some(cap => cap.id === measurementid) ); 
  if (measurementDevices.length > 0) { 
    let totalMeasurement = measurementDevices.reduce((sum, device) => { 
      let measurement = device.capabilities.find(cap => cap.id === measurementid); 
      return sum + (measurement.value || 0);
    }, 0); 
    let averageMeasurement = totalMeasurement / measurementDevices.length;
    return { available: true, average: averageMeasurement }; 
  } else { 
    return { available: false, average: 0 }; 
  } 
}

module.exports = {

  async getZoneClimate({ homey, query }) {
    const filterCapabilities = ['measure_temperature', 'measure_humidity', 'measure_co2', 'measure_pm25', 'measure_etoh', 'measure_iaq', 'measure_tvoc', 'measure_co'];
    const { zoneid } = query;

    homey.app.log('Init Homey API');

    this.homeyAPI = HomeyAPI.forCurrentHomey(homey); // Refresh
    this.homeyAPI.then(x => this.homeyAPI = x);
    await this.homeyAPI;
    homey.app.log('Now retrieve the devices for this zone: '+zoneid);
    let myDevices = Object.values(await this.homeyAPI.devices.getDevices());
    homey.app.log('Filter devices for zone='+zoneid);
    let zoneDevices = myDevices.filter(device => device.zone === zoneid);
    zoneDevices = zoneDevices.filter(device => device.settings.climate_exclude === false);
    homey.app.log('Homey Zone device count: '+zoneDevices.length);
    homey.app.log('Now filter my devices on climate capabilities');
    let filteredDevices = zoneDevices.filter(element => 
      filterCapabilities.some(capability => element.capabilities.includes(capability)) 
    ).map(device => (
      { 
        name: device.name, 
        capabilities: Object.values(device.capabilitiesObj),
    }));
    //homey.app.log(JSON.stringify(filteredDevices));
    homey.app.log('Now create my return object');
    let returnObj = {};
    filterCapabilities.forEach(capability => { 
      returnObj[capability] = createmeasurements(capability, filteredDevices); 
    });
    homey.app.log(JSON.stringify(returnObj));
    return returnObj;
  },

};
