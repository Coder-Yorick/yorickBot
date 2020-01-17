const request = require('request');
const cheerio = require('cheerio');

const SNOW_JAPAN_URL = 'https://www.snowjapan.com/japan-ski-resorts/niigata/yuzawa/iwappara/snow-weather-reports';

function QuerySnow() {

    this.GetSnowDepth = function (ski_resort) {
        if (ski_resort == '岩原') {
            request(SNOW_JAPAN_URL, (err, res, body) => {
                try {
                    const $ = cheerio.load(body, { decodeEntities: false });
                    let $snow_depth = $('div.resort-option-box-main').eq(0).find('tr').eq(0).find('td').eq(1);
                    callback($snow_depth.text());
                } catch (e) {
                    console.log(e.message);
                }
            });
        } else
            callback('查無此雪場資訊');
    }
}

var querySnow = new QuerySnow();

module.exports = querySnow;
