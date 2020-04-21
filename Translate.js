const request = require('request');
const querystring = require('querystring');
const token = require('google-translate-token');

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const CHINESE_RANGE_REGEX = /[\u2E80-\u2FD5\u3190-\u319f\u3400-\u4DBF\u4E00-\u9FCC\uF900-\uFAAD]/;

function Translate() {
    /* 是否含有中文*/
    this.isTWtext = function (text) {
        return text.toString().match(CHINESE_RANGE_REGEX);
    }

    this.exec = function (to, text) {
        return new Promise((resolve, reject) => {
            let t_from = 'auto';
            let t_to = (to == null ? 'zh-TW' : to);
            token.get(text).then(tk => {
                let options = {
                    client: 'gtx',
                    sl: t_from,
                    tl: t_to,
                    dt: 't',
                    ie: 'UTF-8',
                    oe: 'UTF-8',
                    q: text
                };
                options[tk.name] = tk.value;
                return TRANSLATE_URL + '?' + querystring.stringify(options);
            }).then(t_url => {
                request(t_url, (err, res, body) => {
                    let data = JSON.parse(body);
                    try {
                        resolve(data[0][0][0]);
                    } catch {
                        reject();
                    }
                });
            });
        });
    }
}

var translate = new Translate();

module.exports = translate;
