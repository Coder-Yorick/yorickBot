const request = require('request');

function KeepHerokuAlive() {
	this.serverURL = '';
    this.TimeDelay = 50 * 60 * 1000; // default 50 min
    this.KeepLiveCallCount = 0;
    this.Running = false;
    this.SetTimedelay = sec => {
        this.TimeDelay = sec;
    }
    this.TimerRun = () => {
        this.Running = true;
        setTimeout(() => {
            if (this.Running) {
                this.SayHiToServer();
                this.TimerRun();
            }
        }, this.TimeDelay);
    }
    this.TimerStop = () => {
    	this.Running = false;
    }
    this.SayHiToServer = () => {
    	request(this.serverURL, (err, res, body) => {
    		this.KeepLiveCallCount++;
    		console.log('KeepLiveCallCount = ' + this.KeepLiveCallCount);
    	});
    }
}

var keepHerokuAlive = new KeepHerokuAlive();

module.exports = keepHerokuAlive;
