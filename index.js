const linebot = require('linebot');
const express = require('express');

/* Utility*/
const LineItem = require('./LineItem.js');
const {GConst,ENV} = require('./GlobalConst.js');

/* Library*/
const MyLib = require('./MyLib.js');
const Scheduler = require('./Scheduler.js');
const AQI = require('./AQI.js');
const Weather = require('./Weather.js');
const Forex = require('./Forex.js');
const Translate = require('./Translate.js');
const YRedis = require('./YRedis.js');
const LineNotify = require('./LineNotify.js');
const QuerySnow = require('./QuerySnow.js');
const Stock = require('./Stock.js');
const MaskPharmacy = require('./MaskPharmacy.js');

/* linebot setting*/
const bot = linebot({
    channelId: ENV.LINE.CHANNEL_ID,
    channelSecret: ENV.LINE.CHANNEL_SECRET,
    channelAccessToken: ENV.LINE.CHANNEL_ACCESS_TOKEN
});
const SERVER_PORT = ENV.PORT;
const app = express();
const linebotParser = bot.parser();
app.post('/linewebhook', linebotParser);

/* redis setting*/
YRedis.Initial(ENV.REDIS.REDIS_HOST, ENV.REDIS.REDIS_PORT, ENV.REDIS.REDIS_PWD);

/* global variables*/
var GVars = {
    UserStorage: {}
};

bot.on('message', function (event) {
    switch (event.message.type) {
        case 'text': //文字
            let proc = InterpretMessage(event.message.text, event.source);
            if (proc != null && typeof proc == 'function')
                proc(msg => event.reply(msg));
            break;
        case 'image': //圖片
            event.message.content().then(function (data) {
                return event.reply('這圖美喔!');
            }).catch(function (err) {
                return event.reply(err.toString());
            });
            break;
        case 'video': //影片
            event.reply('Nice video!');
            break;
        case 'audio': //音檔
            event.reply('Nice audio!');
            break;
        case 'location': //定位
            let proc = InterpretLocation(event.message.latitude, event.message.longitude, event.source);
            if (proc != null && typeof proc == 'function')
                proc(msg => event.reply(msg));
            break;
        case 'sticker': //貼圖
            event.reply(event.message);
            break;
        default:
            event.reply('Unknow message: ' + JSON.stringify(event));
            break;
    }
});

bot.on('postback', function (event) {
    let userID = MyLib.GetSourceUserID(event.source);
    if (GVars.UserStorage.hasOwnProperty(userID)) {
        let proc = InterpretPostback(event.postback.data, userID);
        if (proc != null && typeof proc == 'function')
            proc(msg => event.reply(msg));
    } else {
        event.reply('請重新點選要用的功能喔~ ' + String.fromCodePoint(0x1000AD));
    }
});

bot.on('join', function (event) {
    let groupID = MyLib.GetSourceUserID(event.source);
    bot.push(groupID, {
        type: 'sticker',
        packageId: 2,
        stickerId: 34
    });
    event.reply('大家好~');
});

bot.on('leave', function (event) {
    console.log(event);
});

bot.on('follow', function (event) {
    try {
        let userID = MyLib.GetSourceUserID(event.source);
        event.source.profile().then(profile => {
            bot.push(GConst.DEVELOPERID, ['UserID:\n' + userID + '\n' + profile.displayName + '\n加你的小幫手好友摟～', {
                type: 'sticker',
                packageId: 2,
                stickerId: 100
            }]);
        });
    } catch(e) {
        console.log(e);
    }
});

bot.on('unfollow', function (event) {
    console.log(event);
});

app.get('/', function (req, res) {
    res.send('小幫手啟動了!');
});

app.listen(SERVER_PORT || 80, function () {
    console.log('LineBot is running.');
    try {
        bot.push(GConst.DEVELOPERID, ['小幫手啟動搂～\n現在版本為' + GConst._VERSION + '版～', {
            type: 'sticker',
            packageId: 2,
            stickerId: 144
        }]);
    } catch (e) {
        console.log(e.message);
    }
    /* Connect Redis */
    try {
        YRedis.Connect(result => {
            if (result) {
                bot.push(GConst.DEVELOPERID, ['Redis connected success!']);
                /* Scheduler */
                try {
                    Scheduler.Initial();
                    /* update data events */
                    let publisher = (obs, msgs) => bot.push(obs, msgs);
                    let events = [];
                    events = events.concat(Scheduler.getDefaultStockEvents(YRedis, Stock, ['2520', '2545', '5880', '0056', '0050']));
                    events = events.concat(Scheduler.getDefaultWeatherEvents(YRedis, Weather));
                    events = events.concat(Scheduler.getDefaultMaskPharmacyEvents(YRedis, MaskPharmacy));
                    events.map(eventInfo => {
                        Scheduler.registerEvent(eventInfo.name, eventInfo.func);
                    });
                    // /* weather observer events */
                    // let observerEvents = [];
                    // observerEvents = observerEvents.concat(Scheduler.getDefaultWeatherObserverEvents(YRedis, publisher));
                    // observerEvents.map(eventInfo => {
                    //     Scheduler.registerEvent(eventInfo.name, eventInfo.func, 15);
                    // });
                    // /* stock observer events */
                    // let observerStockEvents = [];
                    // observerStockEvents = observerStockEvents.concat(
                    //     Scheduler.getDefaultStockObserverEvents(YRedis, publisher, [GConst.DEVELOPERID, GConst.TESTERIDS[2]], ['0050', '0056']));
                    // observerStockEvents = observerStockEvents.concat(
                    //     Scheduler.getDefaultStockObserverEvents(YRedis, publisher, [GConst.TESTERIDS[0]], ['2520', '2545', '5880']));
                    // observerStockEvents.map(eventInfo => {
                    //     Scheduler.registerEvent(eventInfo.name, eventInfo.func, 10);
                    // });
                    Scheduler.start();
                } catch (ex) {
                    bot.push(GConst.DEVELOPERID, ['Scheduler startup fail!']);
                }
            } else {
                bot.push(GConst.DEVELOPERID, ['Redis connected fail!']);
            }
        });
    } catch (ex) {
        console.log(ex.message);
    }
});

/* 處理收到定位動作 */
const InterpretLocation = function (lat, lng, source) {
    /* 附近口罩地圖查詢 */
    let queryMaskOperate = callback => {
        MaskPharmacy.FindNearby(YRedis, lng, lat, nearby_pharmacies => {
            if (nearby_pharmacies.length > 3) {
                nearby_pharmacies = nearby_pharmacies.slice(0, 3);
            }
            let msg = '';
            nearby_pharmacies.forEach(nearby_pharmacy => {
                msg += `${MaskPharmacy.MaskIcon}${nearby_pharmacy.pharmacy.info.name}\n`;
                msg += `地址: ${nearby_pharmacy.pharmacy.info.address}\n`;
                msg += `電話: ${nearby_pharmacy.pharmacy.info.phone}\n`;
                msg += `成人: ${nearby_pharmacy.mask.adult}個\n`;
                msg += `兒童: ${nearby_pharmacy.mask.child}個\n`;
                if (nearby_pharmacy.mask.note != null && nearby_pharmacy.mask.note.length > 0) {
                    msg += `注意事項: ${nearby_pharmacy.mask.note}\n`;
                }
                msg += `更新時間: ${nearby_pharmacy.mask.updated}\n`;
                msg += '\n';
            });
            if (msg.length > 0) {
                callback(msg);
            } else {
                callback('找不到附近藥局口罩資訊');
            }
        });
    }
    return callback => queryMaskOperate(callback);
}

/* 解譯輸入文字*/
const InterpretMessage = function (text, source) {
    let userID = MyLib.GetSourceUserID(source);
    /* 功能類判斷*/
    if (text == '查詢空氣品質') {
        GVars.UserStorage[userID] = {
            mode: GConst.USERMode.AQI,
            type: null,
            item: null
        };
        return callback => callback(new MenuTemplate(GConst.USERMode.AQI));
    } else if (text == '查詢天氣狀況') {
        GVars.UserStorage[userID] = {
            mode: GConst.USERMode.WEATHER,
            type: null,
            item: null
        };
        return callback => callback(new MenuTemplate(GConst.USERMode.WEATHER, userID));
    } else if (text == '查詢匯率') {
        GVars.UserStorage[userID] = {
            mode: GConst.USERMode.FOREX,
            type: null,
            item: null
        };
        return callback => callback(new MenuTemplate(GConst.USERMode.FOREX));
    } else if (text == '翻譯') {
        if (GVars.UserStorage.hasOwnProperty(userID) && GVars.UserStorage[userID].mode == GConst.USERMode.TRANSLATE)
            return callback => TranslateOperate(userID, GVars.UserStorage[userID], text, callback);
        else {
            GVars.UserStorage[userID] = {
                mode: GConst.USERMode.TRANSLATE,
                type: null,
                item: null
            };
            return callback => TranslateOperate(userID, GVars.UserStorage[userID], null, callback);
        }
    } else if (text.length > 4 && text.indexOf('空氣品質') == text.length - 4) {
        /* 查空氣品質*/
        var position = text.replace('的空氣品質', '').replace('空氣品質', '');
        GVars.UserStorage[userID] = {
            mode: GConst.USERMode.AQI,
            type: null,
            item: null
        };
        return callback => AQIOperate(userID, GVars.UserStorage[userID], position, callback);
    } else if (text.toUpperCase().indexOf('HI') == 0) {
        /* 回應貼圖測試*/
        var stickerIDs = text.toUpperCase().replace('HI', '').split(',');
        var packageID = stickerIDs.length > 1 ? stickerIDs[0] * 1 : 1;
        var stickerID = stickerIDs.length > 1 ? stickerIDs[1] * 1 : stickerIDs[0] * 1;
        return function (callback) {
            callback({
                type: 'sticker',
                packageId: packageID,
                stickerId: stickerID || 2
            });
        }
    } else if (text.toUpperCase().indexOf('USERID') == 0) {
        /* 查自己的Line User ID*/
        return callback => callback('你的UserID:' + userID);
    } else if (text.toUpperCase().indexOf('RESETREDIS') == 0) {
        return callback => YRedis.ClearDB(result => callback(result ? 'Redis清除成功' : 'Redis清除失敗'));
    } else if (text.toUpperCase().indexOf('LIFF') == 0) {
        /* LIFF 網頁*/
        return callback => callback(GConst.MYLIFFURL);
    } else if (text.toUpperCase().indexOf('LINENOTIFY') == 0) {
        /* Line Notify Test*/
        let msg = text.toUpperCase().replace('LINENOTIFY', '');
        return callback => {
            LineNotify.push(msg, success => {
                callback(success ? '發送成功!' : '發送失敗!');
            });
        };
    } else if (text == '雪' || text == '滑雪') {
        /* 雪況查詢 */
        return callback => QuerySnowOperate(userID, GVars.UserStorage[userID], null, callback);
    } else if (text.toUpperCase().indexOf('SCHEDULE') == 0) {
        /* 排程器時間間隔設定並重啟 */
        let schedule_cmd = text.toUpperCase().replace('SCHEDULE', '');
        if (schedule_cmd.indexOf('T') === 0) {
            /* 若為SCHEDULET, 則為指定幾點幾分時區啟動 ex: SCHEDULET072008 => 指定 07:20 GMT+8 啟動 */
            let settings = schedule_cmd.replace('T', '');
            let hour = null, minute = 0, timeoffset = 8;
            if (settings.length >= 2)
                hour = settings.substring(0, 2) * 1;
            if (settings.length >= 4)
                minute = settings.substring(2, 4) * 1;
            if (settings.length >= 6)
                timeoffset = settings.substring(4, 6) * 1; 
            return callback => {
                Scheduler.stop();
                if (hour !== null && typeof hour === 'number' && typeof minute === 'number' && typeof timeoffset === 'number') {
                    Scheduler.scheduleStart(hour, minute, timeoffset, (msg) => bot.push(GConst.DEVELOPERID, [msg]));
                    callback(`排程重設完成! (目前已暫停,將於${hour}點${minute}分(GMT+${timeoffset})重新啟動)`);
                } else {
                    callback(`排程器已中止! (format like SCHEDULET072008)`);
                }
            };
        } else {
            /* 設定時間間隔, 並立刻重啟排程器 ex: SCHEDULE86400 => 設定一天跑一次, 立刻重新啟動 */
            let setting_sec = schedule_cmd * 1;
            return callback => {
                if (typeof setting_sec === 'number') {
                    Scheduler.stop();
                    if (setting_sec >= 60) {
                        Scheduler.start(setting_sec);
                        callback(`排程重設完成! (${setting_sec}s)`);
                    } else {
                        callback(`排程器已中止! (${setting_sec}s)`);
                    }
                } else {
                    callback(`排程重設失敗! (${setting_sec}s)`);
                }
            };
        }
    } else if (text.toUpperCase().indexOf('SERVERTIME') == 0) {
        /* 查詢系統時間 */
        let now = new Date();
        let utcTime = `${now.getUTCHours()}:${now.getUTCMinutes()}`;
        let localTime = `${now.getHours()}:${now.getMinutes()}`;
        return callback => callback(`UTC: ${utcTime}\nLocal: ${localTime}`);
    } else if (GVars.UserStorage.hasOwnProperty(userID)) {
        /* 功能模式已啟動*/
        return callback => MenuFunction(userID, text, callback);
    }
    return null;
}

const InterpretPostback = function (data, userID) {
    switch (GVars.UserStorage[userID].mode) {
        case GConst.USERMode.AQI:
            if (GConst.USERModeType.QUERY3 == data) {
                /* 選則自行輸入地區*/
                return callback => callback('你想要查詢哪個地區的AQI?');
            } else {
                /* 預設選取查詢*/
                GVars.UserStorage[userID].type = data;
                return callback => AQIOperate(userID, GVars.UserStorage[userID], data, callback);
            }
            break;
        case GConst.USERMode.WEATHER:
            if (GConst.USERModeType.QUERY == data || GConst.USERModeType.QUERY1 == data || GConst.USERModeType.QUERY2 == data) {
                /* 切換模式*/
                GVars.UserStorage[userID].type = data;
                return callback => WeatherOperate(userID, GVars.UserStorage[userID], null, callback);
            } else {
                /* 查詢天氣*/
                GVars.UserStorage[userID].item = data;
                return callback => WeatherOperate(userID, GVars.UserStorage[userID], data, callback);
            }
            break;
        case GConst.USERMode.FOREX:
            if (GConst.USERModeType.QUERY == data || GConst.USERModeType.QUERY1 == data) {
                /* 切換模式*/
                GVars.UserStorage[userID].type = data;
                return callback => ForexOperate(userID, GVars.UserStorage[userID], null, callback);
            } else {
                /* 查詢匯率*/
                GVars.UserStorage[userID].item = data;
                return callback => ForexOperate(userID, GVars.UserStorage[userID], data, callback);
            }
            break;
        default:
            break;
    }
}

/* 功能執行*/
const MenuFunction = function (userID, text, callback) {
    switch (GVars.UserStorage[userID].mode) {
        case GConst.USERMode.AQI:
            AQIOperate(userID, GVars.UserStorage[userID], text, callback);
            break;
        case GConst.USERMode.WEATHER:
            WeatherOperate(userID, GVars.UserStorage[userID], text, callback);
            break;
        case GConst.USERMode.FOREX:
            ForexOperate(userID, GVars.UserStorage[userID], text, callback);
            break;
        case GConst.USERMode.TRANSLATE:
            TranslateOperate(userID, GVars.UserStorage[userID], text, callback)
            break;
    }
}

/* 功能Template*/
const MenuTemplate = function (USERMode, userID = null) {
    let template = null;
    switch (USERMode) {
        case GConst.USERMode.AQI:
            template = new LineItem.Template('查詢空氣品質', '請選擇要查詢的地區');
            template.template.actions.push(new LineItem.TemplateAction('臺北市', GConst.USERModeType.QUERY));
            template.template.actions.push(new LineItem.TemplateAction('新北市', GConst.USERModeType.QUERY1));
            template.template.actions.push(new LineItem.TemplateAction('宜蘭縣', GConst.USERModeType.QUERY2));
            template.template.actions.push(new LineItem.TemplateAction('其他地區', GConst.USERModeType.QUERY3));
            break;
        case GConst.USERMode.WEATHER:
            template = new LineItem.Template('查詢天氣狀況', '要查詢哪時的天氣呢');
            template.template.actions.push(new LineItem.TemplateAction('查詢最近36小時天氣', GConst.USERModeType.QUERY));
            template.template.actions.push(new LineItem.TemplateAction('查詢未來一週天氣', GConst.USERModeType.QUERY1));
            if (userID !== null) {
                if (Scheduler.checkWeatherEventExist(userID)) {
                    template.template.actions.push(new LineItem.TemplateAction('取消天氣預報通知', GConst.USERModeType.QUERY3));
                } else {
                    template.template.actions.push(new LineItem.TemplateAction('訂閱天氣預報通知', GConst.USERModeType.QUERY2));
                }
            }
            break;
        case GConst.USERMode.FOREX:
            template = new LineItem.Template('查詢匯率', '要查詢哪種匯率資訊呢');
            template.template.actions.push(new LineItem.TemplateAction('臺銀即期匯率', GConst.USERModeType.QUERY));
            template.template.actions.push(new LineItem.TemplateAction('近一個月匯率走勢', GConst.USERModeType.QUERY1));
            break;
    }
    return template;
}

/* AQI查詢-執行*/
const AQIOperate = function(userid, storage, text, callback) {
    let position = '';
    if (storage.type != null) {
        /* 選取縣市*/
        switch (storage.type) {
            case GConst.USERModeType.QUERY:
                position = '臺北市';
                break;
            case GConst.USERModeType.QUERY1:
                position = '新北市';
                break;
            case GConst.USERModeType.QUERY2:
                position = '宜蘭縣';
                break;
        }
    } else {
        /* 自行輸入地區*/
        position = text;
    }
    delete GVars.UserStorage[userid];
    AQI.GetAQI(position, data => {
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

/* 天氣查詢-執行*/
const WeatherOperate = function (userid, storage, text, callback) {
    if (text == null) {
        /* 縣市列表*/
        let county_template = new LineItem.Template('縣市列表', '請點選要查的縣市');
        Weather.GetCountyList().forEach(county => {
            county_template.template.actions.push(new LineItem.TemplateAction(county, county));
        });
        callback(county_template);
    } else {
        /* 查縣市天氣*/
        if (storage.type == GConst.USERModeType.QUERY) {
            delete GVars.UserStorage[userid];
            Weather.GetThirtySixWeather(text, results => {
                callback(results);
            });
        } else if (storage.type == GConst.USERModeType.QUERY1) {
            delete GVars.UserStorage[userid];
            Weather.GetOneWeekWeather(text, results => {
                callback(results);
            });
        } else if (storage.type == GConst.USERModeType.QUERY2) {
            /* 訂閱天氣預報通知 */
            delete GVars.UserStorage[userid];
            let publisher = (observerID, msgs) => bot.push(observerID, msgs);
            let subscribe_result = Scheduler.addWeatherEvent(YRedis, publisher, userid, text);
            callback(`訂閱${text}天氣預報通知${subscribe_result ? '成功': '失敗'}`);
        } else if (storage.type == GConst.USERModeType.QUERY3) {
            /* 取消天氣預報通知 */
            delete GVars.UserStorage[userid];
            Scheduler.removeWeatherEvent(userid);
            callback('已取消訂閱天氣預報通知');
        }
    }
}

/* 匯率查詢-執行*/
const ForexOperate = function (userid, storage, text, callback) {
    if (text == null) {
        /* 貨幣列表*/
        let currency_template = new LineItem.Template('外幣列表', '請點選要查的幣別');
        Forex.GetCurrencyKindList().forEach(cur => {
            currency_template.template.actions.push(new LineItem.TemplateAction(cur.Name, cur.ID));
        });
        callback(currency_template);
    } else {
        /* 查詢幣別資訊*/
        if (storage.type == GConst.USERModeType.QUERY) {
            delete GVars.UserStorage[userid];
            Forex.GetCurrentForex(text, results => {
                callback(results);
            });
        } else if (storage.type == GConst.USERModeType.QUERY1) {
            delete GVars.UserStorage[userid];
            let currency_url = Forex.GetTrendChartImageUrl(text);
            if (currency_url != '') {
                callback({
                    type: "image",
                    originalContentUrl: currency_url,
                    previewImageUrl: currency_url
                });
            } else
                callback('');
        }
    }
}

/* 翻譯-執行*/
const TranslateOperate = function(userid, storage, text, callback) {
    if (text == null) {
        callback('請輸入要翻譯的文字是什麼?');
    } else {
        delete GVars.UserStorage[userid];
        YRedis.GetStr(text, result => {
            if (result == null) {
                let transKind = Translate.isTWtext(text) ? 'en' : 'zh-TW';
                Translate.exec(transKind, text, results => {
                    YRedis.Set(text, results, r => console.log(r ? 'set redis success': 'set redis fail'));
                    callback(results);
                });
            } else
                callback(result);
        });
    }
}

/* 雪況查詢-執行*/
const QuerySnowOperate = function(userid, storage, text, callback) {
    QuerySnow.GetSnowDepth('岩原', results => {
        callback(results);
    });
}