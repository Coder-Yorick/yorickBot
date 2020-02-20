const {GConst} = require('./GlobalConst.js');

function Scheduler() {
    this.durationSecs = 86400; /* daily */
    this.timer = null;
    this.running = false;
    this.events = {};

    this.Initial = () => {
        this.stop();
        this.events = {};
    }

    this.registerEvent = (eventName, eventFunc, delay = 0) => {
        if (this.events.hasOwnProperty(eventName) || typeof eventFunc !== 'function')
            return false;
        else {
            this.events[eventName] = {
                delay: delay,
                func: eventFunc
            };
            return true;
        }
    }

    this.unregisterEvent = (eventName) => {
        if (this.events.hasOwnProperty(eventName))
            delete this.events[eventName];
    }

    this.start = (sec = 86400, execOnce = false) => {
        if (this.running) return;
        if (sec > 0)
            this.durationSecs = sec;
        this.running = true;
        let process = () => {
            for (let eventName in this.events) {
                try {
                    if (typeof this.events[eventName].func === 'function')
                        setTimeout(this.events[eventName].func, this.events[eventName].delay * 1000);
                } catch (ex) {
                    console.log(ex);
                }
            }
        } 
        if (execOnce)
            process();
        this.timer = setInterval(process, this.durationSecs * 1000);
    }

    this.stop = () => {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
            this.running = false;
        }
    }

    this.scheduleStart = (hour, minute = 0, timeoffset = 8) => {
        let chk_proc = () => {
            let now = new Date();
            if (hour === (now.getUTCHours() + timeoffset) && minute === now.getUTCMinutes()) {
                this.start(this.durationSecs, true);
            } else {
                setTimeout(chk_proc, 30000);
            }
        }
        chk_proc();
    }

    this.getDefaultStockEvents = (yRedis, stock, stockIDs = ['2520', '2545', '5880']) => {
        let eventInfos = [];
        stockIDs.map(stockID => {
            eventInfos.push({
                name: stockID, 
                func: () => {
                    stock.GetStockInfo(stockID, result => {
                        yRedis.Set(`stock-${stockID}`, result, r => {});
                    });
                }
            });
        });
        return eventInfos;
    }

    this.getDefaultWeatherEvents = (yRedis, weather) => {
        let eventInfos = [];
        eventInfos.push({
            name: 'weather', 
            func: () => {
                let parseRecords = records => {
                    let info = {
                        date: null, 
                        minT: null, 
                        maxT: null,
                        pop: null,
                        nextdate_minT: null,
                        nextdate_maxT: null,
                        nextdate_pop: null
                    };
                    info.date = records.length > 0 ? records[0].date : null;
                    records.map(record => {
                        if (info.date === record.date && record.endHr * 1 !== 6) {
                            info.pop = (info.pop && info.pop > record.pop) ? info.pop : record.pop;
                            info.minT = (info.minT && info.minT < record.minT) ? info.minT : record.minT;
                            info.maxT = (info.maxT && info.maxT > record.maxT) ? info.maxT : record.maxT;
                        } else if (info.date !== record.date && record.startHr * 1 === 6 && record.endHr * 1 === 18) {
                            info.nextdate_minT = record.minT;
                            info.nextdate_maxT = record.maxT;
                            info.nextdate_pop = record.pop;
                        }
                    });
                    return info;
                }
                weather.GetOriginData('臺北市', 'ThirtySix', records => {
                    yRedis.Set(`weather-taipei`, parseRecords(records), r => {});
                });
                weather.GetOriginData('宜蘭縣', 'ThirtySix', records => {
                    yRedis.Set(`weather-ilan`, parseRecords(records), r => {});
                });
                weather.GetOriginData('新北市', 'ThirtySix', records => {
                    yRedis.Set(`weather-newtaipei`, parseRecords(records), r => {});
                });
            }
        });
        return eventInfos;
    }

    this.getDefaultStockObserverEvents = (yRedis, publishFunc, observers = [], stockIDs = ['2520', '2545', '5880']) => {
        let eventInfos = [];
        observers.map(observer => {
            eventInfos.push({
                name: `line-push-stock-${observer}`, 
                func: () => {
                    stockIDs.map(stockID => {
                        yRedis.GetObj(`stock-${stockID}`, null, stockInfo => {
                            if (stockInfo) {
                                let msg = `${stockInfo.name}\n`;
                                msg += `現價: ${stockInfo.price}\n`;
                                msg += `漲跌: ${stockInfo.spread}`;
                                publishFunc(observer, [msg]);
                            }
                        });
                    });
                }
            });
        });
        return eventInfos;
    }

    this.getDefaultWeatherObserverEvents = (yRedis, publishFunc) => {
        let eventInfos = [];
        let weatherInfoFormat = (city, weatherInfo) => {
            let msg = `== ${city} (${weatherInfo.date}) ==\n`;
            msg += `氣溫: ${weatherInfo.minT} ～ ${weatherInfo.maxT} ℃\n`;
            msg += `降雨: ${weatherInfo.pop}％\n`;
            if (weatherInfo.nextdate_minT && weatherInfo.nextdate_maxT) {
                msg += `明天: ${weatherInfo.nextdate_minT} ～ ${weatherInfo.nextdate_maxT} ℃`;
                if (weatherInfo.nextdate_pop)
                    msg += ` (${weatherInfo.nextdate_pop}％)`;
            }
            return msg;
        }
        [GConst.DEVELOPERID, GConst.TESTERIDS[3]].map(observer => {
            eventInfos.push({
                name: `line-push-weather-${observer}`, 
                func: () => {
                    yRedis.GetObj('weather-taipei', null, weatherInfo => {
                        if (weatherInfo) {
                            publishFunc(observer, [weatherInfoFormat('臺北市', weatherInfo)]);
                        }
                    });
                }
            });
        });
        [GConst.TESTERIDS[0], GConst.TESTERIDS[1]].map(observer => {
            eventInfos.push({
                name: `line-push-weather-${observer}`, 
                func: () => {
                    yRedis.GetObj('weather-ilan', null, weatherInfo => {
                        if (weatherInfo) {
                            publishFunc(observer, [weatherInfoFormat('宜蘭縣', weatherInfo)]);
                        }
                    });
                }
            });
        });
        [GConst.TESTERIDS[2]].map(observer => {
            eventInfos.push({
                name: `line-push-weather-${observer}`, 
                func: () => {
                    yRedis.GetObj('weather-newtaipei', null, weatherInfo => {
                        if (weatherInfo) {
                            publishFunc(observer, [weatherInfoFormat('新北市', weatherInfo)]);
                        }
                    });
                }
            });
        });
        return eventInfos;
    }
}

var scheduler = new Scheduler();

module.exports = scheduler;
