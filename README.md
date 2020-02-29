# botclient.js
Bot client for hack.chat written in JavaScript (browser &amp; nodejs)

### Example bot
```javascript
const Bot = require('./botclient.js');

var bot = new Bot('MyBot', 'my-channel');
bot.owner = 'your-tripcode-here';
bot.trigger = '!';

bot.onMessage = (args)=>{
	console.log(args);
}

bot.onAccessDenied = (args, cmd, pars, arr)=>{
	bot.Say('You\'re not allowed to use this command :(');
}

bot.Commands = {
	test: {
		available: (args)=>{ return args.trip === bot.owner; },
		run: (args, pars, arr)=>{
			bot.Say('```JS\n'+JSON.stringify({args:args, pars:pars, arr:arr}, null, 2)+'\n```');
		},
	},

	echo: {
		run: (args, pars, arr)=>{
			bot.Say(arr.join(' '));
		}
	},
	
	disconnect: {
		run: (args, pars, arr)=>{
			bot.Disconnect();
		}
	}
};

bot.Connect();
```
