var WHATDOREGEX = /wh?at (\w+)$/;
var PASSWORD = 'nope';
// Bot config
var config = {
    server: "irc.rizon.net",
    botName: "koromobot",
    options: {
        channels: [],
        userName: "koromobot",
        realName: "Koromo",
        floodProtection: true,
        floodProtectionDelay: 400,
    },
};

var messageQueue = [];

var allowedPaths = [
    "/game.html",

    "/keypress.js",
    "/musicplayer.js",

    "/bgm/chip.mp3",
    "/bgm/lavos.mp3",
    "/bgm/daisy.mp3",
    "/bgm/lttp.mp3",
    "/bgm/glider.mp3",
    "/bgm/stampede.mp3",
    "/bgm/giovanni.mp3",

    "/se/nipaa.mp3",
    "/se/patchi.mp3",
    "/se/diethedeath.mp3",
    "/se/gokigenyo.mp3",
];

var admins = ['AyaIsMyBirdu', 'Patchypatchy', 'DKPL', 'neil|uni', 'neil|worku'];

var ignoreList = [];
var sequences = {
    clue: ['murder', 'weapon', 'scene', 'motive', 'catchphrase', 'consequence'],
}

function addIgnore(name){
    if (!_.contains(ignoreList, name)) ignoreList.push(name);
}
function removeIgnore(name){
    ignoreList = _.without(ignoreList, name);
}

var spamTimeout = {};

var commands = {
    '.message' : function (to, from, text, message) {
        var splitMessage = numSplit(text, ' ', 2);
        var storedMessage = {
            sender : from,
            target : splitMessage[1],
            content : splitMessage[2],
            time : moment(),
        }
        messageQueue.push(storedMessage);
    },

    // Admin only
    '.join' : function (to, from, text, message) {
        if (!(_.contains(admins, from))) return false;
        var target = numSplit(text, ' ', 1)[1];
        join(target);
    },
    '.cite' : function (to, from, text, message) {
        if (!(_.contains(admins, from))) return false;
        var target = numSplit(text, ' ', 1)[1];
        sendCitation(target);
    },
    '.ignore' : function (to, from, text, message) {
        if (!(_.contains(admins, from))) return false;
        var target = numSplit(text, ' ', 1)[1];
        addIgnore(target);
    },
    '.unignore' : function (to, from, text, message) {
        if (!(_.contains(admins, from))) return false;
        var target = numSplit(text, ' ', 1)[1];
        removeIgnore(target);
    },
    '.def' : function (to, from, text, message) {
        if (!(_.contains(admins, from))) return false;
        var splitCmd = text.split(' ');
        if (splitCmd.length > 2) // Has commands, add to sequence
            sequences[splitCmd[1]] = splitCmd.slice(2);
        else //No commands, remove from sequence
            delete sequences[splitCmd[1]];
    },
    '.contest' : function (to, from, text) {
        if (!(_.contains(admins, from))) return false;
        var splitCmd = text.split(' ');
        var c = new Contest(splitCmd[1], splitCmd[2], {client: bot, server: app}, splitCmd[3], splitCmd[4]);
    },
}


var holdingBall = false;

var irc = require("irc");
var repl = require("repl");
var moment = require("moment");
var _ = require('underscore');
var app = require('http').createServer(handler);
var fs = require('fs');
var url = require('url');
var Contest = require('./Contest.js');

if (!process.argv[2]){
    app.listen(10808);
}
else {
    config.botName = process.argv[2].toString();
}
var bot = new irc.Client(config.server, config.botName, config.options);

bot.addListener('error', function(message) {console.log('error: ', message);}); //Log errors instead of crashing
bot.addListener("message", handleMessage);
bot.addListener("join", handleJoin);
bot.addListener("part", handlePart);
bot.addListener("raw", handleRaw);


function greetable(name){

    if (name == config.botName) return false;

    for (var i = 0; i < ignoreList.length; i++){
        if (name.match(ignoreList[i])) return false;
    }
    return true;
}

function handler (req, res) {
    pathname = url.parse(req.url).pathname;
    if (!_.contains(allowedPaths, pathname)) return false;
    res.setHeader("Accept-Ranges", "bytes");
    console.log('hosting page');
    if (req.method == 'POST') {

        req.on('data', function(chunk) {
                req.content = (req.content ? req.content + chunk : chunk);
                });

        req.on('end', function() {
                // empty 200 OK response for now
                res.writeHead(200, "OK", {'Content-Type': 'text/html'});
                var info = JSON.parse(req.content.toString());
                console.log(info);
                if (info['join'])
                    join(info['join']);
                if (info['citation'])
                    sendCitation(info['citation']);
                if (info['messages'])
                    res.write(JSON.stringify(messageQueue));

                res.end();
                });
    }
    else {
    // If they pick any other path, try to load the file matching the url.
    try {
        var data = fs.readFileSync(__dirname + pathname);
    } catch(e) {
        // If the file isn't found, fail
        return;
    }

   //Get some info about the file, useful for caching
   var stats = fs.statSync(__dirname + pathname);
   var mtime = stats.mtime;
   var size = stats.size;

   //Get the if-modified-since header from the request
   var reqModDate = req.headers["if-modified-since"];

   //check if if-modified-since header is the same as the mtime of the file 
   if (reqModDate != null) {
       reqModDate = new Date(reqModDate);
       if(reqModDate.getTime() == mtime.getTime()) {
           //Yes: then send a 304 header without data (will be loaded by cache)
           res.writeHead(304, {
                   "Last-Modified": mtime.toUTCString()
                   });

           res.end();
           return true;
       }
    }
     
   //No: then send the headers and the file
    res.writeHead(200, {
       "Last-Modified": mtime.toUTCString(),
       "Content-Length": size
    });

       res.write(data);
       res.end();
    }



}

function checkMessages(nick){
    var messageText;
    _.each(_.filter(messageQueue, function(m) {return (new RegExp(m.target, 'i')).test(nick);}), function(m){
        messageText = "From " + m.sender + " : " + m.content + " -- Sent " + m.time.fromNow();
        bot.say(nick, messageText);
        bot.say(m.sender, "Message \"" + m.content + " \" received by " + nick);
        messageQueue = _.without(messageQueue, m);
    });
}

function nickservIdentify(pass){
    bot.say('NickServ', 'IDENTIFY' + pass);
}


function handleMessage(from, to, text, message){
    console.log(to + ":  " + from + " -- " + text);
    checkMessages(from);
    var matched = WHATDOREGEX.exec(text);

    // What dos have returned!
    if (matched && matched[1]) handleWhatDo(from, to, matched[1]);

    if (to == config.botName && text[0] == '.'){
        var command = text.split(' ', 1)[0];
        if (_.isFunction(commands[command]))
            commands[command](to, from, text, message);
    }
}

function handleJoin(channel, nick,  message){
    if (nick === config.botName)
        nickservIdentify(PASSWORD); // Identify on join

    console.log(nick + " joined " + channel);
    if (nick == 'd3bot') bot.say(channel, "kill d3bot");
    else if (greetable(nick))  bot.say(channel, "Hi, " + nick);
    checkMessages(nick);
}

function handlePart(channel, nick,  message){
    console.log(nick + " left " + channel);
}

function handleRaw(message){
    var what = ""; //The object they throw
    if (isAction(message)) {
        console.log(message.args[0] + " : " + message.nick + " -- "  + message.args[1]);
        if (what = threwBall(message))
            setTimeout(tryToCatch, Math.floor(Math.random() * 800 + 600), message, what);
    }
}

function isAction(message){
    if (message.args.length < 2) return false;
    return (message.args[1][0].charCodeAt() == 1);
}

function tryToCatch(message, what){
    var target = (message.args[0] == config.botName ? message.nick : message.args[0]);
    if (!holdingBall) {
        bot.action(target, "catches the " + what);
        holdingBall = true;
        setTimeout(function() {holdingBall = false; bot.action(target, "throws the " + what + " back to " + message.nick);},
            Math.floor(Math.random() * 1800 + 4200));
    }

    else {
        bot.action(message.args[0], "gets hit on the head by the " + what);
        bot.say(message.args[0], ";_;");
    }
}

// Determines whether they threw the ball
function threwBall(message){
    var result = /throws (?:the |a |an )?((?:\S+ )+)(?:to|at) koromo(?:bot|)/i.exec(message.args[1]);
    if (null == result) return false;
    return result[1].replace(/\s$/,"");
}

// What Do?

function kick(user, channel, message){
    message = message || "Boot to the head!";
    try {
        bot.send('KICK', channel, user, message); 
    } catch (e) {
        console.log(e);
    }
}

function handleWhatDo(from, to, listName){
    var target = to;


    if (!spamTimeout[from]) spamTimeout[from] = {};

    if (target == config.botName) {target = from;}
    else {

        // Antispam timer resets to a minute every time you ask
        clearTimeout(spamTimeout[from].timer);

        spamTimeout[from].timer = setTimeout(function(){spamTimeout[from].disabled = false;}, 1000 * 60);

        if (spamTimeout[from].disabled) return false; //Prevent spamming in chats
        spamTimeout[from].disabled = true;
    }

    var botSays = (_.has(sequences, listName) ? whatSequence(listName) : getListResponse(listName)); //sequences of what do
    console.log("koromo responds: " + botSays + " to " + target);
    if (!botSays) return false;
    if (botSays.length > 400) return false;



    bot.say(target, replacePlaceholders(botSays, from));
}

//Special case of what do
function whatSequence(keyword){
    var sequence = sequences[keyword];
    var initialResponse = "What ";
    _.each(sequence, function(word, index){
        initialResponse += word;
        initialResponse += "?  ";
        initialResponse += getListResponse(word) + '.';
        if (index !== sequence.length -1) initialResponse += "  What ";
    });
    return initialResponse;
}

function getListResponse(listName){
    try {
        var fullList = fs.readFileSync('../ayabot/ayabot/' + listName + '.txt', 'utf8').split('\n');
        fullList.pop();
    } catch(e) {
        // If the file isn't found, send them to an error page.
        console.log("Could not find " + listName);
        return false;
    }
    return (_.sample(fullList));
}

function replacePlaceholders(message, asker){
    var newMessage;
    newMessage = message.replace("{asker}", asker);

    /*while _.contains("{random_user}", message) {
        var randomUser = userList[random.randint(0,len(userList)-1)]
        message = message.replace("{random_user}", randomUser, 1)
    }*/
    return newMessage;
}

// Interact with chat through command line
var cons = repl.start({});
cons.context.say = say;
cons.context.act = act;
cons.context.swap = swap;
cons.context.join = join;
cons.context.quit = quit;
cons.context.queueMessage = queueMessage;
cons.context.viewQueue = viewQueue;
cons.context.whatDo = whatDo;
cons.context.viewUnable = viewUnable;

REPLchannel = config.options.channels[0];

function swap(channel){
    REPLchannel = "#" + channel
}

function say(message, channel){
    var target = channel || REPLchannel;
    if (target[0] != '#') target = '#' + target;
    bot.say(target, message);
    return(target + ":  " + config.botName + " -- " + message);
}

function sendCitation(target){
    var message = '[citation needed]';
    if (target[0] != '#') target = '#' + target;
    bot.say(target, irc.colors.wrap('dark_blue', message));
    return(target + ":  " + config.botName + " -- " + message);
}

function act(message, channel){
    var target = channel || REPLchannel;
    bot.action(target, message);
}

function join(channel){
    if (channel[0] != '#')
        channel = '#' + channel;

    bot.join(channel, function(){});
}

function quit(channel, leaveMessage){
    var reason = leaveMessage || "Bye";
    bot.part("#" + channel, reason)
}

function queueMessage(text){
    commands['.message']('koromobot', 'koromo', '.message ' + text);
}

function viewQueue(){
    console.log(messageQueue);
}

function whatDo(listName){
    return getListResponse(listName);
}

function viewUnable(){
    console.log(spamTimeout);
}
// Utility

function numSplit(text, letter, amount){
    var replaced = 0;
    for (var i = 0; i < text.length && replaced < amount; i++){
        if (text[i] == letter) {
            text = text.substr(0, i) +  String.fromCharCode(22) + text.substr(i+1);
            replaced++;
        }
    }
    return text.split(String.fromCharCode(22));
}
