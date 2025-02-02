'use strict';

const { HomeyAPI } = require('athom-api');

function createmeasurements(measurementid, devices)
{
  let measurementDevices = devices.filter(device => device.capabilities.some(cap => cap.id === measurementid) );
  let measurementUnit = null;
  if (measurementDevices.length > 0) { 
    let totalMeasurement = measurementDevices.reduce((sum, device) => { 
      let measurement = device.capabilities.find(cap => cap.id === measurementid);
      console.log(JSON.stringify(measurement));
      measurementUnit=measurement.units;
      return sum + (measurement.value || 0);
    }, 0); 
    let averageMeasurement = totalMeasurement / measurementDevices.length;
    return { available: true, average: averageMeasurement, units: measurementUnit}; 
  } else { 
    return { available: false, average: 0, units: measurementUnit }; 
  } 
}

// Collect all nested zones 
function collectZones(zones, zoneId, traverse) { 
  let collectedZones = [zoneId];
  if(!traverse)
    return collectedZones;
  //Only do recursive calls if the user want to use nested zones
  let subZones = zones.filter(zone => zone.parent === zoneId); 
  for (let subZone of subZones) 
  { 
    collectedZones = collectedZones.concat(collectZones(zones, subZone.id, traverse)); 
  } 
  return collectedZones; 
}

module.exports = {

  async getZoneClimate({ homey, query }) {
    const filterCapabilities = ['measure_temperature', 'measure_humidity', 'measure_co2', 'measure_pm25', 'measure_etoh', 'measure_iaq', 'measure_tvoc', 'measure_co'];
    const { zoneid, includeChild } = query;

    homey.app.log('Init Homey API');

    this.homeyAPI = HomeyAPI.forCurrentHomey(homey); // Refresh
    this.homeyAPI.then(x => this.homeyAPI = x);
    await this.homeyAPI;
    homey.app.log('Now retrieve the devices for this homey');
    let myDevices = Object.values(await this.homeyAPI.devices.getDevices());
    homey.app.log('Now retrieve the zones for this homey');
    let myZones = Object.values(await this.homeyAPI.zones.getZones());
    homey.app.log('Now find all relevant zones, nested below the selected ['+includeChild+']');
    const allRelevantZones = collectZones(myZones, zoneid, includeChild);
    homey.app.log('Filter devices for zones='+JSON.stringify(allRelevantZones));
    //let zoneDevices = myDevices.filter(device => device.zone === zoneid);
    let zoneDevices = myDevices.filter(device => allRelevantZones.includes(device.zone));
    homey.app.log('Now exclude from the current list of devices all the ones that are excluded from climate: '+zoneDevices.length)
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
    homey.app.log('Now create my return object');
    let returnObj = {};
    filterCapabilities.forEach(capability => { 
      returnObj[capability] = createmeasurements(capability, filteredDevices); 
    });
    homey.app.log(JSON.stringify(returnObj));
    return returnObj;
  },

};
