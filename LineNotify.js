const request = require("request");
const querystring = require('querystring');
const {ENV} = require('./GlobalConst.js');

const LINE_NOTIFY_URL = "https://notify-api.line.me/api/notify";

function LineNotify() {
    this.push = (message, callback) => {
        request({
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Bearer ' + ENV.LINE.NOTIFTY_AUTH
            },
            uri: LINE_NOTIFY_URL,
            body: querystring.stringify({
                message: message
            }),
            method: 'POST'
        }, function (err, response, body) {
            callback(response.statusCode == 200);
        });
    };
}

var lineNotify = new LineNotify(); 

module.exports = lineNotify;
