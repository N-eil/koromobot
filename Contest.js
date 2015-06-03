var _ = require('underscore');
var url = require('url');
var domain = 'http://idlemaster.ayati.me';

// Module for koromobot to host contests

function Contest(type, channel, config, numQuestions, timer){
    if (!Contest.isSupported(type)){
        console.log("This contest type is not supported.");
        return false;
    }

    this.type = type;
    this.questionFormat = Contest.CONTESTS[type].format;
    this.clue = Contest.CONTESTS[type].clue;
    this.guessables = Contest.CONTESTS[type].guessables;
    this.questionBank = Contest.CONTESTS[type].questions;

    if (channel[0] != '#')
        this.channel = '#' + channel;
    else this.channel = channel;

    this.numQuestions = numQuestions || 10;
    this.timer = (1000 * timer) || (1000 * 60); // 60 second default
    this.currentQuestion = 0;
    this.scores = {}

    this.bot = config.client;
    this.server = config.server;

    this.start();
}

Contest.prototype.start = function(){
    var startMessage = "Beginning a " + this.type + " contest with " + this.numQuestions + " questions.";
    var t = this;
    console.log('In ' + this.channel + ':  ' + startMessage);

    if (_.contains(_.pluck(this.bot.chans, 'key'), this.channel)) { // Bot is already in the channel
        t.bot.say(t.channel, startMessage);
        t.askQuestion();
    }
    else {
        this.bot.join(this.channel, function(){ //Bot needs to join before message
            t.bot.say(t.channel, startMessage);
            t.askQuestion();
        });
    }
}

Contest.prototype.askQuestion = function(){
    this.currentQuestion++;
    if (this.currentQuestion > this.numQuestions) {
        return this.endContest();
    }
    this.bot.say(this.channel, 'Question ' + this.currentQuestion + ':');
    var t = this;
    var question = _.sample(this.questionBank);
    var category = _.sample(this.guessables);
    var answer = question[category];
    console.log('answer ' + answer);
    var questionText = this.questionFormat.replace('&&&', category) + domain + this.hostVideo(question[this.clue]);
    this.bot.say(this.channel, questionText);

    function checkAnswer(from, text){
        console.log(text);
        if (text.toLowerCase() === answer.toLowerCase()){
            t.endQuestion(checkAnswer, answer, from);
        }
    }

    this.bot.addListener('message' + this.channel, checkAnswer);
    this.questionTimer = setTimeout(function(){t.endQuestion(checkAnswer, answer);}, t.timer);
}

Contest.prototype.endQuestion = function(checkFunction, answer, answerer){
    this.bot.removeListener('message' + this.channel, checkFunction);
    this.server.removeListener('request', this.hostingFunction);
    clearTimeout(this.questionTimer);

    if (answerer) {
        this.bot.say(this.channel, answerer + ' is correct and earns 1 point!');
        this.scores[answerer] = this.scores[answerer] ? this.scores[answerer] + 1 : 1;
    }
    else 
        this.bot.say(this.channel, 'Time up.  The answer was ' + answer);

    this.askQuestion();
}

Contest.prototype.hostVideo = function(link, audioOnly){
    var videoPath = '/' + this.type + this.currentQuestion;
    this.hostingFunction = function(req, res){
        var pathname = url.parse(req.url).pathname;
        if (pathname !== videoPath) return false;
        console.log('hosting video');
        res.setHeader("Accept-Ranges", "bytes");

        res.writeHead(200, {
           "Cache-Control": 'no-cache',
           "Content-Type": 'text/html'
        });
        var data = 'Audio:<br><div style="position:relative;width:267px;height:25px;overflow:hidden;">' +
                      '<div style="position:absolute;top:-276px;left:-5px">' +
                        '<iframe width="300" height="300"'  +
                          'src="https://www.youtube.com/embed/' + link + '?rel=0&autoplay=1">' +
                        '</iframe>' +
                      '</div>' +
                    '</div>';
       res.write(data);
       res.end();
    }
    this.server.addListener('request', this.hostingFunction);
    return videoPath;
}

Contest.prototype.endContest = function(){
    var t = this;
    var ranking = _.sortBy(_.keys(this.scores), function(name) {return t.scores[name];});
    var rankingText = '';
    _.each(ranking, function(name){
        rankingText += (name + ": " + t.scores[name] + '\n');
    });
    this.bot.say(this.channel, 'The contest is over.  Scores: ');
    this.bot.say(this.channel, rankingText);
    this.bot.say(this.channel, "Thanks for playing!");
}

// Constants & non-instance methods
Contest.CONSTANT = 'const';

Contest.isSupported = function(type){
    return _.contains(Contest.listSupportedTypes(), type);
}

Contest.listSupportedTypes = function(){
    return _.keys(Contest.CONTESTS);
}

Contest.CONTESTS = {
    'touhou': {
        format: 'Guess the &&&: ',
        guessables: ['character'],
        clue: 'video',
        questions: [
            {video: 'vS_a8Edde8k', character: 'sakuya', circle: 'samplecircle'},
            /*{video: 'www.youtube2.com', character: 'sample2', circle: 'samplecircle2'},
            {video: 'www.youtube3.com', character: 'sample3', circle: 'samplecircle3'},
            {video: 'www.youtube4.com', character: 'sample4', circle: 'samplecircle4'},
            {video: 'www.youtube5.com', character: 'sample5', circle: 'samplecircle5'},*/
        ],
    },
};


// Tests

// Export
module.exports = Contest;
