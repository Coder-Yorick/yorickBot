const request = require('request');

const MASK_REALTIME_DATA = 'https://raw.githubusercontent.com/kiang/pharmacies/master/json/points.json';
const NEARBY_DISTANCE = 80;

function MaskPharmacy() {

    this.QueryAll = function (callback) {
        request({url:MASK_REALTIME_DATA, json: true}, (error, response, body) => {
            try {
                callback(this.formatData(body));
            } catch (e) {
                console.log(e.message);
            }
        });
    }

    this.FindNearby = function (lng, lat, callback) {
        this.QueryAll(pharmacies => {
            if (pharmacies) {
                /* find nearby pharmacies */
                let nearby_pharmacies = [];
                pharmacies.forEach(pharmacy => {
                    try {
                        let location_distance = Math.pow((lng - pharmacy.pharmacy.lng) * 10000, 2) + Math.pow((lat - pharmacy.pharmacy.lat) * 10000, 2);
                        if (location_distance <= (NEARBY_DISTANCE * NEARBY_DISTANCE)) {
                            pharmacy.distance = location_distance;
                            /* sort by distance */
                            let idx = 0;
                            for (idx = nearby_pharmacies.length; i > 0; i--) {
                                if (nearby_pharmacies[i].distance < pharmacy.distance) {
                                    break;
                                }
                            }
                            nearby_pharmacies.splice(idx, 0, pharmacy);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                });
                callback(nearby_pharmacies);
            } else {
                callback([]);
            }
        });
    }
}

MaskPharmacy.prototype.MaskIcon = String.fromCodePoint(0x100020);

MaskPharmacy.prototype.formatData = (jdata) => {
    try {
        let pharmacies = [];
        jdata['features'].forEach(pharmacy => {
            let info = pharmacy['properties'];
            let lnglat = pharmacy['geometry']['coordinates'];
            let pharmacy_data = {
                lng: lnglat[0],
                lat: lnglat[1],
                info: {
                    id: info['id'],
                    name: info['name'],
                    phone: info['phone'],
                    address: info['address']
                }
            }
            pharmacies.push({
                pharmacy: pharmacy_data,
                mask: { /* pharmacy mask information */
                    adult: info['mask_adult'],
                    child: info['mask_child'],
                    updated: info['updated'],
                    note: info['note']
                }
            });
        });
        return pharmacies;
    } catch(e) {
        return [];
    }
}

var maskPharmacy = new MaskPharmacy();

module.exports = maskPharmacy;