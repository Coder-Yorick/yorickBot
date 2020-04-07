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
            let loc_proc = InterpretLocation(event.message.latitude, event.message.longitude, event.source);
            if (loc_proc != null && typeof loc_proc == 'function')
                loc_proc(msg => event.reply(msg));
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
                    /* update data tasks */
                    Scheduler.getDefaultStockTasks(YRedis, Stock, ['2520', '2545', '5880', '0056', '0050']).map(task => {
                        Scheduler.registerTask(task.name, task);
                    });
                    Scheduler.getDefaultWeatherTasks(YRedis, Weather).map(task => {
                        Scheduler.registerTask(task.name, task);
                    });
                    /* default weather observer tasks */
                    let publisher = (obs, msgs) => bot.push(obs, msgs);
                    Scheduler.addWeatherTask(YRedis, publisher, GConst.DEVELOPERID, '臺北市');
                    Scheduler.addWeatherTask(YRedis, publisher, GConst.TESTERIDS[0], '宜蘭縣');
                    Scheduler.addWeatherTask(YRedis, publisher, GConst.TESTERIDS[1], '宜蘭縣');
                    Scheduler.addWeatherTask(YRedis, publisher, GConst.TESTERIDS[2], '新北市');
                    Scheduler.addWeatherTask(YRedis, publisher, GConst.TESTERIDS[3], '臺北市');
                    /* default stock observer tasks */
                    Scheduler.addStockTask(YRedis, publisher, GConst.DEVELOPERID, '0056');
                    Scheduler.addStockTask(YRedis, publisher, GConst.DEVELOPERID, '0050');
                    Scheduler.addStockTask(YRedis, publisher, GConst.TESTERIDS[2], '0056');
                    Scheduler.addStockTask(YRedis, publisher, GConst.TESTERIDS[2], '0050');
                    Scheduler.addStockTask(YRedis, publisher, GConst.TESTERIDS[0], '2520');
                    Scheduler.addStockTask(YRedis, publisher, GConst.TESTERIDS[0], '2545');
                    Scheduler.addStockTask(YRedis, publisher, GConst.TESTERIDS[0], '5880');
                    Scheduler.start(msg => {
                        bot.push(GConst.DEVELOPERID, [msg]);
                    });
                } catch (ex) {
                    console.log(ex);
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
        MaskPharmacy.FindNearby(lng, lat, nearby_pharmacies => {
            if (nearby_pharmacies.length > 3) {
                nearby_pharmacies = nearby_pharmacies.slice(0, 3);
            }
            let msgs = [];
            nearby_pharmacies.forEach(nearby_pharmacy => {
                let title = `${nearby_pharmacy.pharmacy.info.name}\n`;
                title += `成人: ${nearby_pharmacy.mask.adult}個\n`
                title += `兒童: ${nearby_pharmacy.mask.child}個\n`;
                if (nearby_pharmacy.mask.note != null && nearby_pharmacy.mask.note.length > 0) {
                    title += `公告:\n${nearby_pharmacy.mask.note}\n`;
                }
                title += `(${nearby_pharmacy.mask.updated})`;
                msgs.push({
                    type: 'location',
                    title: title,
                    address: `${nearby_pharmacy.pharmacy.info.address}`,
                    latitude: nearby_pharmacy.pharmacy.lat,
                    longitude: nearby_pharmacy.pharmacy.lng
                });
            });
            if (msgs.length > 0) {
                msgs.reverse();
                callback(msgs);
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
        /* 排程器設定 */
        let schedule_cmd = text.toUpperCase().replace('SCHEDULE', '');
        if (schedule_cmd.indexOf('T') === 0) {
            /* 若為SCHEDULET, 則為設定時區 ex: SCHEDULET8 => 指定 GMT+8 */
            let timeoffset = schedule_cmd.replace('T', '') * 1;
            return callback => {
                Scheduler.timeoffset = timeoffset;
                callback(`排程時區設定完成! (GMT+${timeoffset})`);
            };
        } else {
            /* 排程器開關Switch */
            return callback => {
                if (Scheduler.running) {
                    Scheduler.stop(callback);
                } else {
                    Scheduler.start(callback);
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
                /* 選取縣市*/
                GVars.UserStorage[userID].type = data;
                return callback => WeatherOperate(userID, GVars.UserStorage[userID], null, callback);
            } else {
                /* 選取功能*/
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
            template = new LineItem.Template('查詢天氣狀況', '要查詢哪裡的天氣呢');
            template.template.actions.push(new LineItem.TemplateAction('臺北市', GConst.USERModeType.QUERY));
            template.template.actions.push(new LineItem.TemplateAction('新北市', GConst.USERModeType.QUERY1));
            template.template.actions.push(new LineItem.TemplateAction('宜蘭縣', GConst.USERModeType.QUERY2));
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
    }
    if (text == null) {
        /* 功能列表*/
        let func_template = new LineItem.Template('天氣功能', '請點選要使用的功能');
        func_template.template.actions.push(new LineItem.TemplateAction('查詢最近36小時天氣', 'ThirtySix'));
        func_template.template.actions.push(new LineItem.TemplateAction('查詢未來一週天氣', 'OneWeek'));
        if (userid !== null) {
            if (Scheduler.checkWeatherTaskExist(userid, position)) {
                func_template.template.actions.push(new LineItem.TemplateAction('取消天氣預報通知', 'CancelWeatherNotify'));
            } else {
                func_template.template.actions.push(new LineItem.TemplateAction('訂閱天氣預報通知', 'SubscribeWeatherNotify'));
            }
        }
        callback(func_template);
    } else {
        /* 功能執行*/
        if (text == 'ThirtySix') {
            delete GVars.UserStorage[userid];
            Weather.GetThirtySixWeather(position, results => {
                callback(results);
            });
        } else if (text == 'OneWeek') {
            delete GVars.UserStorage[userid];
            Weather.GetOneWeekWeather(position, results => {
                callback(results);
            });
        } else if (text == 'SubscribeWeatherNotify') {
            /* 訂閱天氣預報通知 */
            delete GVars.UserStorage[userid];
            let publisher = (observerID, msgs) => bot.push(observerID, msgs);
            let subscribe_result = Scheduler.addWeatherTask(YRedis, publisher, userid, position);
            callback(`訂閱${position}天氣預報通知${subscribe_result ? '成功': '失敗'}`);
        } else if (text == 'CancelWeatherNotify') {
            /* 取消天氣預報通知 */
            delete GVars.UserStorage[userid];
            Scheduler.removeWeatherTask(userid, position);
            callback(`已取消訂閱${position}天氣預報通知`);
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