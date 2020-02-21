const request = require('request');
const cheerio = require('cheerio');

const WEATHER_TW_URL = 'https://opendata.cwb.gov.tw/api/v1/rest/datastore/';
const WEATHER_TW_METHOD = {
    ThirtySix: 'F-C0032-001',
    OneWeek: 'F-D0047-091'
};
const WEATHER_API_KEY = 'CWB-4C0C1280-0328-4FC1-8434-53EB845F507E';
const WEATHER_CITIES = [
    '臺北市',
    '新北市',
    '宜蘭縣'
];

function Weather() {

    this.GetCountyList = function() {
        return WEATHER_CITIES;
    }

    this.GetOriginData = function(city, method, callback) {
        if (WEATHER_TW_METHOD.hasOwnProperty(method)) {
            let propertiesObject = {
                Authorization: WEATHER_API_KEY,
                format: 'JSON',
                locationName: city
            };
            request({ url: WEATHER_TW_URL + WEATHER_TW_METHOD[method], qs: propertiesObject }, function(err, response, body) {
                try {
                    if (err)
                        callback(err);
                    else {
                        body = JSON.parse(body);
                        callback(weather.ParseThirtySixWeatherInfo(city, body.records, false));
                    }
                } catch (e) {
                    callback('讀取天氣資料異常\n' + e.message);
                }
            });
        } else {
            callback(null);
        }
    }

    this.GetThirtySixWeather = function(city, callback) {
        let propertiesObject = {
            Authorization: WEATHER_API_KEY,
            format: 'JSON',
            locationName: city
        };
        request({ url: WEATHER_TW_URL + WEATHER_TW_METHOD.ThirtySix, qs: propertiesObject }, function(err, response, body) {
            try {
                if (err)
                    callback(err);
                else {
                    body = JSON.parse(body);
                    callback(weather.ParseThirtySixWeatherInfo(city, body.records));
                }
            } catch (e) {
                callback('讀取天氣資料異常\n' + e.message);
            }
        });
    }

    this.GetOneWeekWeather = function(city, callback) {
        let propertiesObject = {
            Authorization: WEATHER_API_KEY,
            format: 'JSON',
            locationName: city,
            elementName: 'WeatherDescription'
        };
        request({ url: WEATHER_TW_URL + WEATHER_TW_METHOD.OneWeek, qs: propertiesObject }, function(err, response, body) {
            try {
                if (err)
                    callback(err);
                else {
                    body = JSON.parse(body);
                    callback(weather.ParseOneWeekWeatherInfo(city, body.records));
                }
            } catch (e) {
                callback('讀取天氣資料異常\n' + e.message);
            }
        });
    }

    this.ParseThirtySixWeatherInfo = function(city, records, string_info = true) {
        if (records.hasOwnProperty('location') && records.location.length > 0) {
            for (let i in records.location) {
                if (city == records.location[i].locationName) {
                    let wElements = records.location[i].weatherElement;
                    let info_map = {
                        _check: ele => {
                            if (!info_map.hasOwnProperty(ele.startTime)) {
                                info_map[ele.startTime] = {
                                    EndTime: ele.endTime,
                                    POP: 0, //降雨機率
                                    MinT: 0, //最低溫
                                    MaxT: 0 //最高溫
                                };
                            }
                        }
                    };
                    for (let w in wElements) {
                        switch (wElements[w].elementName) {
                            case 'PoP':
                            	wElements[w].time.forEach(pop => {
                                    info_map._check(pop);
                                    info_map[pop.startTime].POP = pop.parameter.parameterName * 1;
                                });
                                break;
                            case 'MinT':
                            	wElements[w].time.forEach(mint => {
                                    info_map._check(mint);
                                    info_map[mint.startTime].MinT = mint.parameter.parameterName * 1;
                                });
                                break;
                            case 'MaxT':
                            	wElements[w].time.forEach(maxt => {
                                    info_map._check(maxt);
                                    info_map[maxt.startTime].MaxT = maxt.parameter.parameterName * 1;
                                });
                                break;
                        }
                    }
                    delete info_map['_check'];
                    if (string_info) {
                        let info_str = city + '\n' + records.datasetDescription + '\n****************\n';
                        for (let starttime in info_map) {
                            info_str += '日期:' + starttime.slice(0, 10) + '\n';
                    	    info_str += '時間:' + starttime.slice(11,13) + '時～' + info_map[starttime].EndTime.slice(11,13) + '時\n';
                    	    info_str += '降雨機率:' + info_map[starttime].POP + '％' + '\n';
                    	    info_str += '氣溫:' + info_map[starttime].MinT + '℃' + '～' + info_map[starttime].MaxT + '℃' + '\n';
                    	    info_str += '\n';
                        }
                        return info_str;
                    } else {
                        let infoes = []
                        for (let starttime in info_map) {
                            infoes.push({
                                date: starttime.slice(0, 10),
                                startHr: starttime.slice(11,13),
                                endHr: info_map[starttime].EndTime.slice(11,13),
                                pop: info_map[starttime].POP,
                                minT: info_map[starttime].MinT,
                                maxT: info_map[starttime].MaxT
                            });
                        }
                        return infoes;
                    }
                }
            }
        }
        if (string_info)
            return '查無' + city + '天氣資訊';
        else
            return [];
    }

    this.ParseOneWeekWeatherInfo = function(city, records) {
        if (records.hasOwnProperty('locations') && records.locations.length > 0) {
            let citywdata = records.locations[0].location;
            for (let i in citywdata) {
                if (city == citywdata[i].locationName) {
                    let wElements = citywdata[i].weatherElement;
                    let info_str = city + '\n一週天氣預報\n****************\n';
                    for (let w in wElements) {
                        if (wElements[w].elementName == 'WeatherDescription') {
                            wElements[w].time.forEach(wd => {
                                if (wd.startTime.slice(0,10) == wd.endTime.slice(0,10) && wd.elementValue.length > 0)
                                    info_str += '[' + wd.startTime.slice(0,10) + ']\n' + wd.elementValue[0].value + '\n\n';
                            });
                        }
                    }
                    return info_str;
                }
            }
        }
        return '查無' + city + '天氣資訊';
    }
}

var weather = new Weather();

module.exports = weather;
