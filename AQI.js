const rp = require('request-promise');

const aqi_option = {
    url: 'http://opendata2.epa.gov.tw/AQI.json',
    json: true
};

function AQI() {

    this.GetAQI = function(siteName, callback) {
        rp(aqi_option)
            .then(repos => {
                let data = [];
                for (let i in repos) {
                    if (repos[i].SiteName == siteName || repos[i].County == siteName)
                        data.push(repos[i]);
                }
                callback(data);
            })
            .catch(err => callback(err.message));
    }

    this.GetFormattedAQI = function(siteName, callback) {
        this.GetAQI(siteName, data => {
            if (data.length > 0) {
                let aqi_info = '';
                data.forEach(a => {
                    let aqi_status = AQI.JudgeStatus(a["AQI"]);
                    aqi_info += a.County + '-' + a.SiteName;
                    aqi_info += '\nAQI: ' + a.AQI + (aqi_status.length > 0 ? '(' + aqi_status + ')' : '');
                    aqi_info += '\n狀態: ' + a.Status;
                    if (a['PM2.5_AVG'].length > 0)
                        aqi_info += '\nPM2.5: ' + a['PM2.5_AVG'];
                    if (a.PM10_AVG.length > 0)
                        aqi_info += '\nPM10: ' + a.PM10_AVG;
                    aqi_info += '\n更新時間:' + a.PublishTime;
                    aqi_info += '\n--------\n';
                });
                callback(aqi_info);
            } else {
                callback('找不到這個地區的資料');
            }
        });
    }

    this.JudgeStatus = function(aqi_value) {
        if (aqi_value != "") {
            let _aqi_value = aqi_value * 1.0;
            if (_aqi_value >= 301) { //lv6-black 0x1000A0 
                return String.fromCodePoint(0x1000A0) + '黑燈';
            } else if (_aqi_value >= 201) { //lv5-purple 0x100083
                return String.fromCodePoint(0x100083) + '紫燈';
            } else if (_aqi_value >= 151) { //lv4-red 0x100024
                return String.fromCodePoint(0x100024) + '紅燈';
            } else if (_aqi_value >= 101) { //lv3-orange 0x1000A1
                return String.fromCodePoint(0x1000A1) + '橘燈';
            } else if (_aqi_value >= 51) { //lv2-yellow 0x100062
                return String.fromCodePoint(0x100062) + '黃燈';
            } else { //lv1-green 0x100061 
                return String.fromCodePoint(0x100061) + '綠燈';
            }
        }
        return '';
        //<AQI燈號判斷>
        //lv1-green:  0-50      0x100061 
        //lv2-yellow: 51-100    0x100062
        //lv3-orange: 101-150   0x1000A1 
        //lv4-red:    151-200   0x100024
        //lv5-purple: 201-300   0x100083
        //lv6-black:  301-400   0x1000A0 
        // 1.一般以臭氧(O3)8小時值計算各地區之空氣品質指標(AQI)。但部分地區以臭氧(O3)小時值計算空氣品質指標(AQI)是更具有預警性，在此情況下，臭氧(O3)8小時與臭氧(O3)1小時之空氣品質指標(AQI)則皆計算之，取兩者之最大值作為空氣品質指標(AQI)。
        // 2.空氣品質指標(AQI)301以上之指標值，是以臭氧(O3)小時值計算之，不以臭氧(O3)8小時值計算之。
        // 3.空氣品質指標(AQI)200以上之指標值，是以二氧化硫(SO2)24小時值計算之，不以二氧化硫(SO2)小時值計算之。
        // {
        //     "SiteName": "基隆",
        //     "County": "基隆市",
        //     "AQI": "52",
        //     "Pollutant": "細懸浮微粒",
        //     "Status": "普通",
        //     "SO2": "1.9",
        //     "CO": "0.81",
        //     "CO_8hr": "0.6",
        //     "O3": "8.9",
        //     "O3_8hr": "4",
        //     "PM10": "32",
        //     "PM2.5": "18",
        //     "NO2": "18",
        //     "NOx": "36",
        //     "NO": "18",
        //     "WindSpeed": "0.8",
        //     "WindDirec": "265",
        //     "PublishTime": "2019-04-22 08:00",
        //     "PM2.5_AVG": "16",
        //     "PM10_AVG": "29",
        //     "SO2_AVG": "2",
        //     "Longitude": "121.760056",
        //     "Latitude": "25.129167"
        // },
    }
}

var aqi = new AQI();

module.exports = aqi;
