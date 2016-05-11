$(function() {

    $.fn.extend({
        animateCss: function (animationName) {
            var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            $(this).addClass('animated ' + animationName).one(animationEnd, function() {
                $(this).removeClass('animated ' + animationName);
            });
        }
    });

    var users = [];
    var currentProblem;
    var username;
    var clicked;

    function renderProb(problem) {
        var prob = $("#problem");
        prob.text(problem);
        prob.animateCss('bounceInUp');
    }

    function renderSolutions(solutions) {
        $('#grid').remove();
        $('#grid-wrapper').append('<div id="grid"></div>');
        var grid = $('#grid');
        var currRow;
        for(var i = 0; i < solutions.length; i++) {
            // new row
            if(i % 3 == 0) {
                grid.append('<div id="row-' + i + '" class="row"></div>');
                currRow = $('#row-'+i);
            }
            var solNum = solutions[i];
            currRow.append('<div class="col-xs-4 card"><button id="card-button" class="ui-btn ui-shadow">'+solNum+'</button></div>')
        }
    }

    $(document).on('click', '#card-button', function() {
        var num = $(this).text();
        socketio.emit('answer', { username: username, answer: num });
        clicked = $(this);
    });

    $("#join-game").click(function() {
        promptLogin();
    });

    function promptLogin() {
        BootstrapDialog.show({
            title: 'Please login',
            message: '<label>Enter a username</label><input type="text" id="username-entry" class="form-control" placeholder="treestompz">',
            buttons: [{
                label: 'Join Game',
                action: function(ref) {
                    var username = $("#username-entry").val();
                    if(username == "") {
                        return;
                    }
                    socketio.emit('join-game', { username: username });
                    ref.close();
                }
            }]
        });
    }

    function makeNoty(text, type) {
        var n = noty({
            text: text,
            layout: 'topRight',
            type: type,
            animation: {
                open: 'animated bounceInRight', // Animate.css class names
                close: 'animated bounceOutRight', // Animate.css class names
                easing: 'swing', // unavailable - no need
                speed: 500 // unavailable - no need
            },
            timeout: 2000
        });
    }

    function renderUsers() {
        $("#player-count").text(users.length);
        $("#score").remove();
        $("#stats").append('<table class="table table-striped"id="score"><thead><tr><th>Name<th>Score<th># Correct<th># Wrong</thead></table>');
        for(var i = 0; i < users.length; i++) {
            var muhDom = "<tr>";
            muhDom += '<td>' + users[i].username + '</td>';
            muhDom += '<td>' + users[i].score + '</td>';
            muhDom += '<td>' + users[i].correct + '</td>';
            muhDom += '<td>' + users[i].wrong + '</td>';
            muhDom += "</tr>";
            $("#score").append(muhDom);
        }
    }


    /* Socket.io */
    var socketio = io.connect('http://'+location.hostname+':'+location.port+'');

    socketio.on('username-confirmed', function(data) {
        username = data.username;
        console.log("Confirmed login as:" + username);
    });

    socketio.on('init', function(data) {
        console.log(data)
        var phase = data.phase;
        users = data.users;
        if(phase == 1) {
            $("#waiting").show();
            renderUsers();
        }
    });

    socketio.on('make-noty', function(data) {
        makeNoty(data.text, data.type);
    });

    function isNewUser(username) {
        for(var i = 0; i < users.length; i++) {
            if(users[i].username == username) {
                return false;
            }
        }
        return true;
    }

    socketio.on('users-update', function(data) {
        var newUsers = data.users;
        for(var i = 0; i < newUsers.length; i++) {
            var currName = newUsers[i].username;
            if(isNewUser(currName)) {
                makeNoty(currName + " has joined the game!", "information");
            }
        }
        users = data.users;
        renderUsers();
    });

    socketio.on('warning', function(data) {
        var warning = data.warning;
        BootstrapDialog.show({
            title: 'Warning',
            message: '<h4>'+warning+'</h4>'
        });
    });

    socketio.on('answer-response', function(data) {
        if(data.correct) {
            clicked.css('background-color', 'green');
        } else {
            clicked.css('background-color', 'red');
        }
    });

    socketio.on('waiting-phase', function(data) {
        var countdown = data.countdown;
        var sub = $("#welcome-sub");
        $("#waiting").show();
        $("#grid-wrapper").hide();
        $("#problem-wrapper").hide();
        $("#end-round-wrapper").hide();
        console.log(countdown);
        // don't start countdown
        if(countdown == -1) {
            sub.text("Waiting for 2 or more players to start game countdown...");
        }
        // start countdown
        else {
            sub.text("");
            if(countdown <= 9) {
                sub.append('<span id="waiting-time">0:0' + countdown + '</span> left to join the game!');
            } else {
                sub.append('<span id="waiting-time">0:' + countdown + '</span> left to join the game!');
            }
        }
        if(data.winners) {
            var winners = data.winners;
            var winnerText = "";
            for(var i = 0; i < winners.length; i++) {
                winnerText += winners[i].username + ", ";
            }
            winnerText = winnerText.substring(0, winnerText.length - 2);
            $("#winners").text("The winners are: "+ winnerText +" with a score of: " + winners[0].score);
        }
    });

    function problemCountdown(countdown) {
        setTimeout(function() {
            if(countdown < 10) {
                $("#problem-time").text("0:0"+countdown);
            } else {
                $("#problem-time").text("0:"+countdown);
            }
            if(countdown <= 0) {
                return;
            }
            problemCountdown(countdown - 1);
        }, 1000);
    }

    socketio.on('start-round', function(data) {
        $("#waiting").hide();
        $("#end-round-wrapper").hide();
        problemCountdown(data.countdown - 1);
        $("#problem-wrapper").show();
        $("#grid-wrapper").show();
        $("#rounds").text(data.round + " / " + data.MAX_ROUNDS);
        currentProblem = data.currentProblem;

        renderSolutions(data.solutions);

        renderProb(currentProblem);

        makeNoty("Round has begun!", "information");
    });

    function endRoundCountdown(countdown) {
        setTimeout(function() {
            if(countdown < 10) {
                $("#end-round-time").text("0:0"+countdown + " left until new round starts!");
            } else {
                $("#end-round-time").text("0:"+countdown + " left until new round starts!");
            }
            if(countdown <= 0) {
                return;
            }
            endRoundCountdown(countdown - 1);
        }, 1000);
    }

    socketio.on('end-round', function(data) {
        // put stats at the top
        $("#problem-wrapper").hide();
        $("#grid-wrapper").hide();
        $("#end-round-wrapper").show();
        if(data.roundWinner != null) {
            $("#end-round-title").text("The round winner is:");
            $("#round-winner").text(data.roundWinner.username);
        } else {
            $("#end-round-title").text("That round went to time! Everyone's a loser!");
            $("#round-winner").text("");
        }
        var countdown = data.countdown;
        if(countdown == -1) {
            $("#end-round-time").text("");
        } else {
            $("#end-round-time").text("0:0"+countdown + " left until new round starts!");
            endRoundCountdown(countdown - 1);
        }
    });

});
