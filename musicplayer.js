function MusicPlayer(songList){
    var t = this;
    this.songs = songList;
    this.player = $('<audio/>').appendTo($('body'));
    this.player.attr('hidden', true);
    this.nowIndex = Math.floor(Math.random() * songList.length);
    this.nowPlaying = this.songs[this.nowIndex];
    this.player[0].src = 'bgm/' + this.nowPlaying;

    // Cycle through songs
    this.player.on('ended', function(){
        t.nextSong();
    });

    this.player.on('error', function(){
        console.log(this.player[0].error);
        t.nextSong();
    });

}

MusicPlayer.prototype.play = function(){
    this.player[0].play();
}

MusicPlayer.prototype.pause = function(){
    this.player[0].pause();
}

MusicPlayer.prototype.nextSong = function(){
    var t = this;
    this.nowIndex += 1;
    if (this.nowIndex == this.songs.length) this.nowIndex = 0;

    this.nowPlaying = this.songs[this.nowIndex];
    this.player[0].src = 'bgm/' + this.nowPlaying;

    setTimeout(function(){ t.play();}, 1 * 1000);
}
