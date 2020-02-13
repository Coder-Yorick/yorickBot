function Scheduler() {
    this.durationSecs = 86400 * 1000 / 24 / 60; /* half day */
    this.timer = null;
    this.running = false;
    this.events = {};

    this.Initial = () => {
        this.stop();
        this.events = {};
    }

    this.registerEvent = (eventName, eventFunc) => {
        if (this.events.hasOwnProperty(eventName) || typeof eventFunc !== 'function')
            return false;
        else {
            this.events[eventName] = eventFunc;
            return true;
        }
    }

    this.unregisterEvent = (eventName) => {
        if (this.events.hasOwnProperty(eventName))
            delete this.events[eventName];
    }

    this.start = () => {
        if (this.running) return;
        this.running = true;
        this.timer = setInterval(() => {
            Object.values(this.events).map(function(e) {
                try {
                    if (typeof e === 'function')
                        setTimeout(e, 0);
                } catch (ex) {
                    console.log(ex);
                }
            });
        }, this.durationSecs);
    }

    this.stop = () => {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
            this.running = false;
        }
    }

    this.getDefaultEvents = (yRedis, stock, publishFunc, observers = [], stockIDs = ['2520', '2545', '5880']) => {
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
        observers.map(observer => {
            eventInfos.push({
                name: `line-push-${observer}`, 
                func: () => {
                    stockIDs.map(stockID => {
                        yRedis.GetObj(`stock-${stockID}`, null, stockInfo => {
                            let msg = `${stockInfo.name}\n`;
                            msg += `現價: ${stockInfo.price}\n`;
                            msg += `異動: ${stockInfo.spread}`;
                            publishFunc(observer, [msg]);
                        });
                    });
                }
            });
        });
        return eventInfos;
    }
}

var scheduler = new Scheduler();

module.exports = scheduler;
