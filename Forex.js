const request = require('request');
const cheerio = require('cheerio');

const TRENDCHART_URL = 'https://www.taiwanrate.org/cache/exchangerate$30.png';
const TWBANK_FOREX_URL = 'https://rate.bot.com.tw/xrt?Lang=zh-TW';

const CURRENCY_KIND = {
	USD: '美金',
	JPY: '日幣',
	KRW: '韓元',
	EUR: '歐元'
};

function Forex() {

	this.GetCurrencyKindList = function () {
		let currency_kind_list = [];
		for (let c in CURRENCY_KIND)
			currency_kind_list.push({ ID: c, Name: CURRENCY_KIND[c] });
		return currency_kind_list;
	}

	this.GetCurrentForex = function (currency_kind) {
		return new Promise((resolve, reject) => {
			if (CURRENCY_KIND.hasOwnProperty(currency_kind)) {
				request(TWBANK_FOREX_URL, (err, res, body) => {
					try {
						const $ = cheerio.load(body, { decodeEntities: false });
						let forex_info = '';
						let $kind_tds = $('td.currency');
						for (let i in $kind_tds) {
							try {
								let kind_text = $kind_tds.eq(i).find('div.print_show').html();
								let kind_text_code = kind_text.slice(kind_text.indexOf('(') + 1, kind_text.indexOf(')'));
								if (kind_text_code == currency_kind) {
									forex_info += kind_text.trim() + '\n';
									let $cashs = $kind_tds.eq(i).siblings('td.rate-content-cash');
									let $sights = $kind_tds.eq(i).siblings('td.rate-content-sight');
									if ($cashs.length > 0) {
										$cashs.each((x, cash) => {
											forex_info += $(cash).attr('data-table') + ':' + $(cash).html() + '\n';
										});
									}
									if ($sights.length > 0) {
										$sights.each((y, sight) => {
											forex_info += $(sight).attr('data-table') + ':' + $(sight).html() + '\n';
										});
									}
									break;
								}
							} catch (ex) {
								reject(ex.message);
							}
						}
						resolve(forex_info);
					} catch (e) {
						reject(e.message);
					}
				});
			} else
				resolve('查無此幣別資訊');
		});
	}

	this.GetTrendChartImageUrl = function (currency_kind) {
		if (CURRENCY_KIND.hasOwnProperty(currency_kind)) {
			let turl = TRENDCHART_URL;
			return turl.replace('$', currency_kind);
		}
		return '';
	}
}

var forex = new Forex();

module.exports = forex;