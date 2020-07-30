const browser = typeof(window)!='undefined';

if (!browser) {
	var WebSocket = require('ws');
	var atob = require('atob');
	var btoa = require('btoa');
}

function ICrypt(t,e){this.CharsToBytes=(t=>t.map(function(t){return t.charCodeAt(0)})),this.StringToBytes=(t=>this.CharsToBytes(t.split(""))),this.BytesToChars=(t=>t.map(function(t){return String.fromCharCode(parseInt(t,10))})),this.BytesToString=(t=>this.BytesToChars(t).join("")),this.DecToOctBytes=(t=>t.map(function(t){return("000"+t.toString(8)).substr(-3)})),this.OctToDecBytes=(t=>t.map(function(t){return parseInt(t,8)})),this.Uint8ArrayToIntArray=(t=>{var e=[];for(let r=0;r<t.length;r++)e[r]=t[r];return e}),this.Expand=((t,e,r=8)=>{var s,n=new Uint8Array(t.length*e);for(let e=0;e<n.length;e++){for(let r=0;r<t.length&&!(e+r>=n.length);r++)n[e+r]=t[r];e=e+t.length-1}for(let t=0;t<n.length;t++){if(t==n.length-1){n[t]=n[t]^n[0];break}n[t]=n[t]^n[t+1],n[n.length-t-1]=3^n[n.length-t-1]}s=n,n=new Uint8Array(2*n.length);for(let t=0;t<s.length-1;t+=2){var h=8^s[t],i=13^s[t+1];n[t]=i,n[t+1]=h,n[n.length-1-t]=255^h+i}var a=255;for(let t=0;t<n.length;t++){var o=n[t],l=2*r^255^a;n[t]=o^l,a--,r=n[t],0==a&&(a=255)}return n}),this.Encrypt=(t=>{t=new Uint8Array(t);var e=this.Expand(this.password,Math.floor(t.length/this.password.length)+1,8),r=this.Expand(this.salt,Math.floor(t.length/this.salt.length)+1,8),s=new Uint8Array(t.length);for(let h=t.length-1;h>-1;h--){var n=e[t.length-h]^r[h]^t[h];s[h]=n}return s}),this.password=this.OctToDecBytes(this.DecToOctBytes(this.CharsToBytes(t.split("")))),this.salt=this.OctToDecBytes(this.DecToOctBytes(this.CharsToBytes(e.split(""))))}
function crypt(str, password, salt="") {
    var ic = new ICrypt(password, salt);
    var bytes = ic.StringToBytes(str);
    bytes = ic.Encrypt(bytes);
    return ic.BytesToString(ic.Uint8ArrayToIntArray(bytes));
}

function Bot(nick, channel, password = null) {
    this.url = 'wss://hack.chat/chat-ws';
	this.owner = '';
    this.nick = nick;
    this.password = password;
    this.channel = channel;
    this.onlineUsers = [];
    this.trigger = '!';
    this.ws = null;

    this.onConnect = null; /* ()=>{...} */
    this.onMessage = null; /* (args)=>{...} */
    this.onDisconnect = null; /* ()=>{...} */
    this.onOnlineSet = null; /* (nicks)=>{...} */
    this.onUserJoin = null; /* (args)=>{...} */
    this.onUserLeave = null; /* (args)=>{...} */
    this.onAccessDenied = null; /* (args, cmd, pars, arr)=>{...} */
    this.onUnknownCommand = null; /* (args, cmd)=>{...} */
	this.onUserToggleEncryption = null; /* (nick, encryptionEnabled)=>{...} */

    this.Commands = {};

    //tetherapp
    this.tether = {
        enabled: false,
        encryption: false,
        userKeys: {},
        userKey: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        salt: 'tether',
        keyPrefix: '\x03\x06',
        prefixStr: '\x03\x02',
    }
    function broadcastKey(enabled, bot) {
        if (!bot.tether.enabled) return;
        bot.Send({cmd:'chat', text:bot.tether.keyPrefix+(enabled?bot.tether.userKey:'')});
    }
    this.enableTether = (enabled)=>{
        if (enabled) {
            this.tether.enabled = true;
        } else {
            this.tether.enabled = false;
        }
    }
    this.enableTetherEncryption = (enabled)=>{
        if (enabled) {
            this.tether.enabled = true;
            this.tether.encryption = true;
            broadcastKey(true, this);
        } else {
            this.tether.encryption = false;
            broadcastKey(false, this);
        }
    }

    this.Connect = () => {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({
                cmd: 'join',
                nick: (password != null ? this.nick + '#' + this.password : this.nick),
                channel: this.channel
            }));
            if (this.onConnect != null) this.onConnect();
        }
        this.ws.onmessage = (e) => {
            var args = JSON.parse(e.data);
			
			switch (args.cmd) {
				case 'onlineSet':
                    this.onlineUsers = args.nicks;
                    broadcastKey(true, this);
                    if (this.onOnlineSet!=null) this.onOnlineSet(args.nicks);
					break;
				case 'onlineAdd':
                    this.onlineUsers.push(args.nick);
                    if (this.onUserJoin!=null) this.onUserJoin(args);
                    broadcastKey(true, this);
					break;
				case 'onlineRemove':
					var n = this.onlineUsers.indexOf(args.nick);
					if (n >= 0) {
						this.onlineUsers.splice(n, 1);
                    }
                    if (this.tether.enabled) {
                        if (this.tether.userKeys.hasOwnProperty(args.nick)) delete this.tether.userKeys[args.nick];
                    }
                    if (this.onUserLeave!=null) this.onUserLeave(args);
					break;
            }
            
            if (args.hasOwnProperty('text')) {
                if (args.text.indexOf('\0')==0) args.text = args.text.substr(1); //bypass hack.chat anticmd

                if (args.hasOwnProperty('nick') && args.text.indexOf(this.tether.keyPrefix)==0) {
                    var key = args.text.substr(this.tether.keyPrefix.length);
                    if (key.length>0) {
                        this.tether.userKeys[args.nick] = key;
						if (this.onUserToggleEncryption!=null) this.onUserToggleEncryption(args.nick, true);
                    } else {
                        delete this.tether.userKeys[args.nick];
						if (this.onUserToggleEncryption!=null) this.onUserToggleEncryption(args.nick, false);
                    }
                    return;
                }
            }
			
            if (args.hasOwnProperty('text')) {
                args.tether = {
                    encrypted: false,
                }

                if (args.hasOwnProperty('nick') && this.tether.enabled && this.tether.userKeys.hasOwnProperty(args.nick) && args.text.length > 0 && args.text.indexOf(this.tether.prefixStr) === 0) {
                    try {
                        args.text = crypt(atob(args.text.substr(this.tether.prefixStr.length)), this.tether.userKeys[args.nick], this.tether.salt);
                        args.tether.encrypted = true;
                    } catch (err) {
                    }
                }

				var arr1 = this.Parse(args.text);
                if (arr1.length > 0 && typeof(arr1[0])!='undefined' && this.Commands.hasOwnProperty(arr1[0].substr(this.trigger.length)) && arr1[0].startsWith(this.trigger)) {
				    var arr2 = args.text.split(' ');
                    var cmd = arr1[0].substr(this.trigger.length).toLowerCase();
                    arr1.shift();
                    arr2.shift();
                    if (typeof(this.Commands[cmd].available)=='undefined'||this.Commands[cmd].available(args)) {
                        if (typeof(this.Commands[cmd].run)=='function') this.Commands[cmd].run(args, arr1, arr2);
                    } else {
                        if (this.onAccessDenied!=null) this.onAccessDenied(args, cmd, arr1, arr2);
                    }
                    return;
                } else if (arr1.length > 0 && typeof(arr1[0])!='undefined' && arr1[0].startsWith(this.trigger)) {
                    var cmd = arr1[0].substr(this.trigger.length).toLowerCase();
                    if (this.onUnknownCommand!=null) this.onUnknownCommand(args, cmd);
                }
            }
            if (this.onMessage != null) this.onMessage(args);
        }
        this.ws.onclose = () => {
            if (this.onDisconnect != null) this.onDisconnect();
        }
    }

    this.Send = (args) => {
        this.ws.send(JSON.stringify(args));
    }

    this.Say = (text) => {
        this.ws.send(JSON.stringify({
            cmd: 'chat',
            text: (this.tether.encryption ? this.tether.prefixStr+btoa(crypt(text, this.tether.userKey, this.tether.salt)) : text)
        }));
    }

    this.Disconnect = () => {
        this.ws.close();
    }

    this.Parse = (text, chr = '"') => {
        var words = text.split(' ');
        var flag = false;
        var output = [];
        var word = [];
        for (let i = 0; i < words.length; i++) {
            if (!flag && words[i].indexOf(chr) == 0 && words[i].lastIndexOf(chr) == words[i].length - 1) {
                output.push(words[i].substr(1, words[i].length - 2));
            } else if (!flag && words[i].indexOf(chr) == 0) {
                flag = true;
                word.push(words[i].substr(1));
            } else if (flag) {
                if (words[i].indexOf(chr) == words[i].length - 1) {
                    flag = false;
                    word.push(words[i].substr(0, words[i].length - 1));
                    if (word.length > 0) output.push(word.join(' '));
                    word = [];
                } else {
                    word.push(words[i]);
                }
            } else {
                output.push(words[i]);
            }
        }
        return output;
    }
}

if (!browser) module.exports = Bot;