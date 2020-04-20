const {GConst} = require('./GlobalConst.js');

function Scheduler() {
    this.durationSecs = 60; /* frequency 60s */
    this.timeoffset = 8;
    this.timer = null;
    this.running = false;
    this.tasks = {};

    this.Initial = () => {
        this.stop();
        this.tasks = {};
    }

    this.start = (callback) => {
        if (this.running) return;
        this.running = true;
        let process = () => {
            for (let taskKey in this.tasks) {
                try {
                    this.tasks[taskKey].exec(this.timeoffset);
                } catch (ex) {
                    console.log(ex);
                }
            }
        }
        this.timer = setInterval(process, this.durationSecs * 1000);
        if (callback !== undefined && typeof callback === 'function') {
            let startTime = new Date();
            callback(`${(startTime.getUTCHours() + this.timeoffset) % 24}點${startTime.getUTCMinutes()}分排程器啟動了!`);
        }
    }

    this.stop = (callback) => {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
            this.running = false;
            if (callback !== undefined && typeof callback === 'function') {
                let stopTime = new Date();
                callback(`${(stopTime.getUTCHours() + this.timeoffset) % 24}點${stopTime.getUTCMinutes()}分排程器停止了!`);
            }
        }
    }

    this.registerTask = (task_key, task) => {
        if (this.tasks.hasOwnProperty(task_key) || typeof task.func !== 'function')
            return false;
        else {
            this.tasks[task_key] = task;
            return true;
        }
    }

    this.unregisterTask = task_key => {
        if (this.tasks.hasOwnProperty(task_key))
            delete this.tasks[task_key];
    }

    this.getDefaultStockTasks = (yRedis, stock, stockIDs = ['2520', '2545', '5880', '0056', '0050']) => {
        let task_list = [];
        stockIDs.map(stockID => {
            let task_key = `stock-${stockID}`;
            let task = new SchedulerTask(task_key);
            task.setTime(9, 15); /* Load opening stock price at 09:15 */
            task.func = () => {
                stock.GetStockInfo(stockID, result => {
                    yRedis.Set(task_key, result, r => {});
                });
            }
            task_list.push(task);
        });
        return task_list;
    }

    this.getDefaultWeatherTasks = (yRedis, weather, cities = ['taipei', 'newtaipei', 'ilan']) => {
        let task_list = [];
        cities.map(city => {
            let city_name = this.parseWeatherCity(city);
            let task_key = `weather-${city}`;
            let task = new SchedulerTask(task_key);
            task.setTime(6, 0); /* Load weather at 06:00 */
            task.func = () => {
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
                weather.GetOriginData(city_name, 'ThirtySix', records => {
                    yRedis.Set(task_key, parseRecords(records), r => {});
                });
            }
            task_list.push(task);
        });
        return task_list;
    }

    this.getDefaultAQITasks = (yRedis, aqi, cities = ['taipei', 'newtaipei', 'ilan']) => {
        let task_list = [];
        cities.map(city => {
            let city_name = this.parseWeatherCity(city);
            let task_key = `aqi-${city}`;
            let task = new SchedulerTask(task_key);
            task.setTime(6, 5); /* Load AQI at 06:05 */
            task.func = () => {
                console.log(city_name);
                aqi.GetFormattedAQI(city_name, data => {
                    yRedis.Set(task_key, data, r => {});
                });
            }
            task_list.push(task);
        });
        return task_list;
    }

    this.addWeatherTask = (yRedis, publishFunc, observerID, city, hour = 7, minute = 20) => {
        let city_key = this.getWeatherCity(city);
        if (city_key === null)
            return false;
        let task_key = `weather-${city_key}-${observerID}`;
        let task = new SchedulerTask(task_key);
        task.setTime(hour, minute); /* Line push weather at hour:minute */
        task.func = () => {
            yRedis.GetObj(`weather-${city_key}`, null, weatherInfo => {
                if (weatherInfo) {
                    publishFunc(observerID, [this.weatherInfoFormat(city, weatherInfo)]);
                }
            });
        }
        return this.registerTask(task_key, task);
    }

    this.removeWeatherTask = (observerID, city) => {
        let city_key = this.getWeatherCity(city);
        let task_key = `weather-${city_key}-${observerID}`;
        this.unregisterTask(task_key);
    }

    this.parseWeatherCity = (city) => {
        switch (city) {
            case 'taipei':
                return '臺北市';
            case 'newtaipei':
                return '新北市';
            case 'ilan':
                return '宜蘭縣';
        }
        return city;
    }

    this.getWeatherCity = (city) => {
        let city_key = null;
        switch (city) {
            case '臺北市': {
                city_key = 'taipei';
                break;
            }
            case '宜蘭縣': {
                city_key = 'ilan';
                break;
            }
            case '新北市': {
                city_key = 'newtaipei';
                break;
            }
            default:
                city_key = city;
        }
        return city_key;
    }

    this.checkWeatherTaskExist = (observerID, city) => {
        let city_key = this.getWeatherCity(city);
        let task_key = `weather-${city_key}-${observerID}`;
        return this.tasks.hasOwnProperty(task_key);
    }

    this.weatherInfoFormat = (city, weatherInfo) => {
        let msg = `= ${city}(${weatherInfo.date}) =\n`;
        msg += `氣溫: ${weatherInfo.minT} ～ ${weatherInfo.maxT} ℃\n`;
        msg += `降雨: ${weatherInfo.pop}％\n`;
        if (weatherInfo.nextdate_minT && weatherInfo.nextdate_maxT) {
            msg += `明天: ${weatherInfo.nextdate_minT} ～ ${weatherInfo.nextdate_maxT} ℃`;
            if (weatherInfo.nextdate_pop)
                msg += ` (${weatherInfo.nextdate_pop}％)`;
        }
        return msg;
    }

    this.addStockTask = (yRedis, publishFunc, observerID, stockID, hour = 9, minute = 20) => {
        let task_key = `stock-${stockID}-${observerID}`;
        let task = new SchedulerTask(task_key);
        task.setTime(hour, minute); /* Line push stock info at hour:minute */
        task.func = () => {
            yRedis.GetObj(`stock-${stockID}`, null, stockInfo => {
                if (stockInfo) {
                    let msg = `${stockInfo.name}\n`;
                    msg += `現價: ${stockInfo.price}\n`;
                    msg += `漲跌: ${stockInfo.spread}`;
                    publishFunc(observerID, [msg]);
                }
            });
        }
        return this.registerTask(task_key, task);
    }

    this.removeStockTask = (observerID, stockID) => {
        let task_key = `stock-${stockID}-${observerID}`;
        this.unregisterTask(task_key);
    }

    this.addAQITask = (yRedis, publishFunc, observerID, city, hour = 7, minute = 18) => {
        let city_key = this.getWeatherCity(city);
        if (city_key === null)
            return false;
        let task_key = `aqi-${city_key}-${observerID}`;
        let task = new SchedulerTask(task_key);
        task.setTime(hour, minute); /* Line push weather at hour:minute */
        task.func = () => {
            yRedis.GetObj(`aqi-${city_key}`, null, aqi_data => {
                if (aqi_data) {
                    publishFunc(observerID, [aqi_data]);
                }
            });
        }
        return this.registerTask(task_key, task);  
    }  
    
    this.removeAQITask = (observerID, city) => {
        let city_key = this.getWeatherCity(city);
        let task_key = `aqi-${city_key}-${observerID}`;
        this.unregisterTask(task_key);
    }
}

function SchedulerTask(name) {
    this.name = name;
    this.func = () => {}
    this.hour = 0;
    this.minute = 0;

    this.exec = (timeoffset = 8) => {
        try {
            if (typeof this.func === 'function') {
                let now = new Date();
                let current_hour = (now.getUTCHours() + timeoffset) % 24;
                let current_minute = now.getUTCMinutes();
                if (this.hour === current_hour && this.minute === current_minute) {
                    setTimeout(this.func, 10);
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    this.setTime = (hour = 0, minute = 0) => {
        this.hour = (hour > 23  || hour < 0) ? 0 : hour;
        this.minute = (minute > 59  || minute < 0) ? 0 : minute;
    }
}

var scheduler = new Scheduler();

module.exports = scheduler;
