'use strict'

const redis = require('redis');

function YRedis() {
    this.client = null;
    this.connection = {
        host: '120.0.0.1',
        port: 6379,
        pwd: ''
    };
}

YRedis.prototype.Initial = function(host, port, pwd) {
    this.connection.host = host;
    this.connection.port = port;
    this.connection.pwd = pwd;
}

YRedis.prototype.Connect = function(callback) {
    try {
        if (this.connection.pwd === undefined || this.connection.pwd === null || this.connection.pwd.length === 0) {
            this.client = redis.createClient({
                port: this.connection.port,
                host: this.connection.host
            });
        } else {
            this.client = redis.createClient({
                port: this.connection.port,
                host: this.connection.host,
                password: this.connection.pwd
            });
        }
        callback(true);
    } catch (e) {
        callback(false);
    }
}

YRedis.prototype.Disconnect = function() {
    try {
        if (this.client != null)
            this.client.quit();
    } catch (e) {
    }
}

YRedis.prototype.ClearDB = function(callback) {
    try {
        if (this.client != null)
            this.client.flushdb();
        callback(true);
    } catch (e) {
        callback(false);
    }
}

YRedis.prototype.JudgeDataType = function(data) {
    try {
        switch (typeof data) {
            case 'number':
            case 'string':
            case 'boolean':
                return 'string';
            case 'object':
                if (Array.isArray(data))
                    return 'array';
                else
                    return 'object';
        }
        return '';
    } catch (e) {
        return '';
    }
}

YRedis.prototype.Set = function(field, data, callback) {
    try {
        if (this.client != null) {
            let dataType = this.JudgeDataType(data);
            if (dataType == 'string') {
                this.client.set(field, data + '', () => {
                    callback(true);
                });
            } else if (dataType == 'object') {
                this.client.hmset(field, data, () => {
                    callback(true);
                });
            } else if (dataType == 'array') {
                if (data.length > 1) {
                    this.client.lpush(field, ...data, () => {
                        callback(true);
                    });
                } else {
                    this.client.lpush(field, data, () => {
                        callback(true);
                    });
                }
            } else
                callback(false);
        } else
            callback(false);
    } catch (e) {
        callback(false);
    }
}

YRedis.prototype.GetStr = function(field, callback) {
    try {
        if (this.client != null) {
            this.client.get(field, (err, data) => {
                if (err)
                    callback(null);
                else
                    callback(data);
            });
        } else
            callback(null);
    } catch (e) {
        callback(null);
    }
}

YRedis.prototype.GetObj = function(field, key, callback) {
    try {
        if (this.client != null) {
            if (key == null) {
                this.client.hgetall(field, (err, data) => {
                    if (err)
                        callback(null);
                    else
                        callback(data);
                });
            } else {
                this.client.hget(field, key, (err, data) => {
                    if (err)
                        callback(null);
                    else
                        callback(data);
                });
            }
        } else
            callback(null);
    } catch (e) {
        callback(null);
    }
}

YRedis.prototype.GetArr = function(field, index, callback) {
    try {
        if (this.client != null) {
            if (index == null) {
                this.client.lrange(field, 0, -1, (err, data) => {
                    if (err)
                        callback(null);
                    else
                        callback(data);
                });
            } else {
                this.client.lindex(field, index, (err, data) => {
                    if (err)
                        callback(null);
                    else
                        callback(data);
                });
            }
        } else
            callback(null);
    } catch (e) {
        callback(null);
    }
}

var yRedis = new YRedis();

module.exports = yRedis;
