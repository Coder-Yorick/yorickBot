const request = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const STOCK_WEBSITE = 'http://goodinfo.tw/StockInfo/StockDividendPolicy.asp?STOCK_ID=';
const DIVIDEND_WEBSITE = 'https://www.moneydj.com/Z/ZG/ZGL/ZGL.djhtm';

function Stock() {

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
                            spread: $stock_table.eq(2).find('td').eq(1).html() * 1,
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