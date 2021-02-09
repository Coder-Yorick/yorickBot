const request = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const STOCK_WEBSITE = 'http://goodinfo.tw/StockInfo/StockDividendPolicy.asp?STOCK_ID=';
const STOCK_TWSE = 'http://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const DIVIDEND_WEBSITE = 'https://www.moneydj.com/Z/ZG/ZGL/ZGL.djhtm';

const MY_TWSE = 'http://twse:5000'

const MY_TWSE_BASE_REQ = (route, method, callback, errResult = null) => {
    request({
        uri: `${MY_TWSE}${route}`,
        method: method
    }, function (err, response, body) {
        try {
            body = JSON.parse(body);
            callback(response.statusCode == 200 && body ? body.result : errResult);
        } catch(e) {
            console.err(e);
            callback(errResult);
        }
    });
}

function Stock() {
    this.TWSE = {
        RecordTask: (stockID, callback) => {
            MY_TWSE_BASE_REQ(`/record/${stockID}`, 'POST', callback, false);
        },
        GetRecord: (stockID, callback) => {
            MY_TWSE_BASE_REQ(`/record/${stockID}`, 'GET', callback);
        },
        ListStore: callback => {
            MY_TWSE_BASE_REQ(`/store/support`, 'GET', callback, []);
        },
        CheckStore: (stockID, callback) => {
            MY_TWSE_BASE_REQ(`/store/check/${stockID}`, 'GET', callback, false);
        },
        CheckTask: callback => {
            MY_TWSE_BASE_REQ(`/task/size`, 'GET', callback, -1);
        },
        JudgeScore: score => {
            if (score != "") {
                const _score = score * 1.0;
                if (_score >= 7) { // 7~10
                    return String.fromCodePoint(0x1000A4);
                } else if (_score >= 4) { // 4~6
                    return String.fromCodePoint(0x10008B);
                } else if (_score >= 2) { // 2~3
                    return String.fromCodePoint(0x100090);
                } else if (_score >= 0) { // 0~1
                    return String.fromCodePoint(0x1000A3);
                } else { // 低於0分
                    return String.fromCodePoint(0x1000A2);
                }
            }
            return '';
        },
    }

    this.QueryStockName = function (stockID) {
        return new Promise((resolve, reject) => {
            request(STOCK_WEBSITE + stockID, (err, res, body) => {
                try {
                    const $ = cheerio.load(body, { decodeEntities: false });
                    let stock_allName = $('nobr a.link_blue[href="StockDetail.asp?STOCK_ID=' + stockID + '"]').html();
                    if (stock_allName != null && stock_allName.indexOf(stockID) >= 0) {
                        stock_allName = stock_allName.replace(stockID, '').trim();
                        if (stock_allName.length == 0)
                            stock_allName = null;
                    } else
                        stock_allName = null;
                    resolve(stock_allName);
                } catch (e) {
                    reject(e.message);
                }
            });
        });
    }

    this.GetStockInfo = function (stockID) {
        return new Promise((resolve, reject) => {
            this.crawStockInfoFromTWSE(stockID).then(data => {
                if (data === null) {
                    this.crawStockInfoFromGoodinfo(stockID).then(gdata => {
                        resolve(gdata);
                    }).catch(e => {
                        reject(e);
                    });
                } else {
                    resolve(data);
                }
            }).catch(e => {
                reject(e);
            });
        });
    }

    this.crawStockInfoFromGoodinfo = (stockID) => {
        return new Promise((resolve, reject) => {
            request(STOCK_WEBSITE + stockID, (err, res, body) => {
                try {
                    const $ = cheerio.load(body, { decodeEntities: false });
                    let $stock_table = $('table[class*=solid] > tbody > tr');
                    let $stock_detail = $('#divDetail > table > tbody tr');
                    let stock_allName = $('nobr a.link_blue[href="StockDetail.asp?STOCK_ID=' + stockID + '"]').html();
                    if ($stock_table != null && $stock_table.length > 0) {
                        let dividend_rate = '-';
                        for (let i = 0; i < $stock_detail.length; i++) {
                            if ($stock_detail.eq(i).find('td').eq(20).html() != '-') {
                                dividend_rate = $stock_detail.eq(i).find('td').eq(20).html();
                                break;
                            }
                        }
                        resolve({
                            name: stock_allName,
                            price: $stock_table.eq(2).find('td').eq(0).html() * 1,
                            spread: $stock_table.eq(2).find('td').eq(2).html() * 1,
                            dividend: dividend_rate
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e.message);
                }
            });
        });
    }

    this.crawStockInfoFromTWSE = (stockID) => {
        return new Promise((resolve, reject) => {
            try {
                let current_ts = Math.floor(Date.now() / 1000);
                let stockUrl = `${STOCK_TWSE}?_=${current_ts}&ex_ch=tse_${stockID}.tw`;
                request({url: stockUrl, json: true}, (err, res, body) => {
                    try {
                        let dt = body.msgArray[0];
                        let price = (dt['z'] != '-' ? dt['z'] : dt['o']) * 1;
                        let yprice = dt['y'] * 1;
                        resolve({
                            name: `${stockID} ${dt['n']}`,
                            price: price.toFixed(2) * 1,
                            spread: (price - yprice).toFixed(2) * 1,
                            dividend: '-'
                        });
                    } catch (ex) {
                        console.log(ex.message);
                        resolve(null);
                    }
                });
            } catch (e) {
                reject(e.message);
            }
        });
    }

    this.GetDividendYieldBoard = function () {
        return new Promise((resolve, reject) => {
            request(DIVIDEND_WEBSITE, (err, res, body) => {
                try {
                    body = iconv.decode(body, "big5");
                    const $ = cheerio.load(body, { decodeEntities: false });
                    let $stock_list = $('#article table tr table tr');
                    if ($stock_list != null && $stock_list.length > 0) {
                        let dividend_rates = [];
                        for (let i = 3; i < $stock_list.length; i++) {
                            let row_price = $stock_list.eq(i).find('td').eq(9).html() * 1;
                            if (row_price < 120) {
                                dividend_rates.push({
                                    dividend: $stock_list.eq(i).find('td').eq(2).html(),
                                    id: $stock_list.eq(i).find('td').eq(1).html().split("'")[3],
                                    price: row_price
                                });
                            }
                        }
                        resolve(dividend_rates);
                    } else
                        resolve([]);
                } catch (e) {
                    reject(e.message);
                }
            });
        });
    }
}

var stock = new Stock();

module.exports = stock;