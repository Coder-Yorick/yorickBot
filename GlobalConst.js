require('dotenv').config()

const ENV = {
    PORT: process.env.PORT,
    LINE: {
        CHANNEL_ID: process.env.CHANNEL_ID,
        CHANNEL_SECRET: process.env.CHANNEL_SECRET,
        CHANNEL_ACCESS_TOKEN: process.env.CHANNEL_ACCESS_TOKEN,
        NOTIFTY_AUTH: process.env.NOTIFTY_AUTH
    },
    REDIS: {
        REDIS_PWD: process.env.REDIS_PWD,
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_DBNAME: process.env.REDIS_DBNAME
    }
}

const GConst = {
    _VERSION: '1.0.5',
    MYWEBURL: 'https://yorick-bot.herokuapp.com/',
    MYLIFFURL: 'line://app/1562262709-g8D3p6eo',
    DEVELOPERID: 'U7840e11a91ef2aa11c5033a44c20762c',
    TESTERIDS: [
        'U5dc421e1d531284fa5f7fe7d28446e6a', // Father
        'Uc6da919ef530d5f5c30c4a5e7a8fb5ac', // Mother
        'Ub3b0731bb4000cf3d024da472135d8e5', // Sister
        'U240b5fedca6a453e7d2e3ea0b7172ff5' // Wife
    ],
    USERMode: {
        MESSAGE2: -100,
        AQI: 100, // 空氣品質
        WEATHER: 200, // 天氣
        FOREX: 300, // 匯率
        TRANSLATE: 400 //中英翻譯
    },
    USERModeType: {
        QUERY: 'Q', //一般查詢
        QUERY1: 'Q1', //特殊查詢1
        QUERY2: 'Q2', //特殊查詢2
        QUERY3: 'Q3' //特殊查詢3
    }
}

module.exports = { GConst, ENV };
