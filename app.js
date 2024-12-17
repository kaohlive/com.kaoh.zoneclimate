'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');

module.exports = class ZoneClimate extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Zone climate app has been initialized');
    try {
			this.homey.dashboards
			  .getWidget('zone-climate')
			  .registerSettingAutocompleteListener('zone', async (query, settings) => {
          this.log("List zones for widget settings");
          this.homeyAPI = HomeyAPI.forCurrentHomey(this.homey); // Refresh
          this.homeyAPI.then(x => this.homeyAPI = x);
          await this.homeyAPI;
          let myZones = Object.values(await this.homeyAPI.zones.getZones());
          this.homey.app.log('Zone count: '+myZones.length);
          this.homey.app.log(JSON.stringify(myZones));

				return Object.values(myZones)
				  .map(zone => ({
					name: zone.name,
					id: zone.id,
				  }))
				  .filter(zone => zone.name.toLowerCase().includes(query.toLowerCase()));
			  });
		  } catch (err) {
			this.log(`Climaste zones might not be available: ${err.message}`);
		  }
  }

};
