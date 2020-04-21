const request = require('request');

const MASK_REALTIME_DATA = 'https://raw.githubusercontent.com/kiang/pharmacies/master/json/points.json';
const NEARBY_DISTANCE = 80;

function MaskPharmacy() {

    this.QueryAll = () => {
        return Promise((resolve, reject) => {
            request({ url: MASK_REALTIME_DATA, json: true }, (error, response, body) => {
                try {
                    resolve(this.formatData(body));
                } catch (e) {
                    reject(e.message);
                }
            });
        })
    }

    this.FindNearby = function (lng, lat) {
        return new Promise((resolve, reject) => {
            this.QueryAll().then(pharmacies => {
                /* find nearby pharmacies */
                let nearby_pharmacies = [];
                pharmacies.forEach(pharmacy => {
                    try {
                        let location_distance = Math.pow((lng - pharmacy.pharmacy.lng) * 10000, 2) + Math.pow((lat - pharmacy.pharmacy.lat) * 10000, 2);
                        if (location_distance <= (NEARBY_DISTANCE * NEARBY_DISTANCE)) {
                            pharmacy.distance = location_distance;
                            /* sort by distance */
                            let idx = 0;
                            for (idx = nearby_pharmacies.length; idx > 0; idx--) {
                                if (nearby_pharmacies[idx - 1].distance < pharmacy.distance) {
                                    break;
                                }
                            }
                            nearby_pharmacies.splice(idx, 0, pharmacy);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                });
                resolve(nearby_pharmacies);
            }).catch(err => {
                console.error(err);
                resolve([]);
            });
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
    } catch (e) {
        return [];
    }
}

var maskPharmacy = new MaskPharmacy();

module.exports = maskPharmacy;