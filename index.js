var express = require('express');
var app = express();
var server = app.listen(3000);
var io = require('socket.io').listen(server);

var math = require('mathjs');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.sendFile(__dirname + "/public/templates/index.html");
});

app.get('/about', function(req, res) {
    res.sendFile(__dirname + "/public/templates/about.html");
});

console.log("App running on port 3000");

// Array of user objects that are currently considered to be playing the game
var users = [];
var usersWhoAnswered = [];
var round = 1;
var currentProblem = "";
var currentAnswer = 0;
var roundWinner = null;
/*
* 1 = Waiting for new game
* 2 = Round Start
* 3 = Round End
*/
var phase = 1;
var waitingCountdownStarted = false;
var waitingTimeLeft = null;

var MAX_ROUNDS = 10;
var WAITING_COUNTDOWN = 30;
var START_COUNTDOWN = 20;
var END_COUNTDOWN = 10;

var startTimer = null;

function updateUser(username, score, correct, wrong) {
    for(var i = 0; i < users.length; i++) {
        if(users[i].username == username) {
            users[i].score += score;
            users[i].correct += correct;
            users[i].wrong += wrong;
            break;
        }
    }
}

// Notify winner, start time till next round, update scores
function endRound(user) {
    clearTimeout(startTimer);
    phase = 3;
    usersWhoAnswered = [];
    if(user) {
        updateUser(user.username, 300, 1, 0);
        roundWinner = user;
    }

    // get ready for a new round
    if(round < MAX_ROUNDS) {
        io.emit('users-update', { users: users });
        io.emit('end-round', { roundWinner: roundWinner, countdown: END_COUNTDOWN });
        round++;
        setTimeout(function() {
            startRound();
        }, 1000 * END_COUNTDOWN);
    }
    // end the game
    else {
        io.emit('users-update', { users: users });
        io.emit('end-round', { roundWinner: roundWinner, countdown: -1 });
        setTimeout(function() {
            endGame();
        }, 1000 * 5);
    }
}

function startRound() {
    phase = 2;
    roundWinner = null;
    // generate new problem
    currentProblem = genProblem();

    // generate new answer
    currentAnswer = math.eval(currentProblem);
    console.log("Answer: " + currentAnswer);

    // generate possible solutions
    var solutions = genSolutions();

    io.emit('start-round', { currentProblem: currentProblem, solutions: solutions, round: round, MAX_ROUNDS: MAX_ROUNDS, countdown: START_COUNTDOWN });

    // start countdown if no one answers in time
    startTimer = setTimeout(function() {
        if(roundWinner == null) {
            endRound();
        }
    }, 1000 * START_COUNTDOWN);
}
var isCount = false;
function waitingPhase(winners) {
    if(users.length < 2) {
        io.emit('waiting-phase', { countdown: -1, winners: winners });
    } else {

        if(waitingTimeLeft == null) {
            waitingTimeLeft = WAITING_COUNTDOWN;
        }
        // start the game
        if(waitingTimeLeft <= 0) {
            waitingTimeLeft = null;
            startRound();
        }
        // keep counting down
        else {
            if(!isCount) {
                return;
            }
            setTimeout(function() {
                isCount = false;
                waitingTimeLeft--;
                console.log("Game starting in: " + waitingTimeLeft);
                io.emit('waiting-phase', { countdown: waitingTimeLeft, winners: winners });
                waitingPhase(winners);
            }, 1000);
        }
    }
}

function endGame() {
    phase = 1;
    round = 1;

    // TODO: add check to make sure all users haven't left to avoid potential crash
    // but there should always be at least 2 users

    // there could be multiple winners
    var winners = [];
    var highestScore = 0;
    // there's multiple ways to do this, but we are gonna find the highest score
    // and then add everyone who has it to winners
    for(var i = 0; i < users.length; i++) {
        if(users[i].score > highestScore) {
            highestScore = users[i].score;
        }
    }

    // find everyone who has that score
    for(var i = 0; i < users.length; i++) {
        if(users[i].score == highestScore) {
            winners.push(users[i]);
        }
    }
    users = [];
    waitingPhase(winners);
}

function genProblem() {
    // Number of integers between 2-4 in this problem
    var numOfInts = Math.floor((Math.random() * 3) + 2);
    var prob = "";
    for(var i = 0; i < numOfInts; i++) {
        // Generate a number between 1 and 10
        var num = Math.floor((Math.random() * 10) + 1);
        prob += num + " ";

        // Don't append an op if we are on the last num
        if(i == numOfInts - 1) {
            break;
        }

        // Choose an operate of +, -, *, / that correspend respectively with 0,1,2,3
        // temp disable /
        var opNum = Math.floor(Math.random() * 3);
        var op;
        switch(opNum) {
            case 0:
                op = "+";
                break;
            case 1:
                op = "-";
                break;
            case 2:
                op = "*";
                break;
            case 3:
                op = "/";
                break;
        }
        prob += op + " ";
    }
    return prob;
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements
    while (0 !== currentIndex) {

        // Pick remaining element
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap with current element
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

  return array;
}

function genSolutions() {
    var solutions = [];
    solutions.push(currentAnswer);
    // we have 8 false solutions to generate
    // save our fingers
    var a = currentAnswer;

    // (2)
    if(a > 1) {
        solutions.push(a - 1);
        solutions.push(a + 1);
    } else {
        solutions.push(a + (a / 10 ));
        solutions.push(a - (a / 10 ));
    }

    // (3)
    solutions.push(a / 2);

    // (4)
    solutions.push(a * 1.25);

    // (5)
    solutions.push(math.eval("cos("+a+") * "+a));

    // (6)
    solutions.push(a + Math.floor((Math.random() * 4) + 2));

    // (7)
    solutions.push(a - Math.floor((Math.random() * 4) + 2));

    // (8)
    solutions.push(a + a);

    // clean up floats to 3 decimal places
    for(var i = 0; i < solutions.length; i++) {
        var num = solutions[i];
        if(num.toString().indexOf('.') > -1) {
            solutions[i] = num.toFixed(3);
        }
    }

    shuffle(solutions);

    return solutions;
}

function makeNoty(socket, text, type) {
    socket.emit('make-noty', { text:text, type: type });
}

function warning(socket, warning) {
    socket.emit('warning', { warning: warning });
}

function isActiveUser(username) {
    for(var i = 0; i < users.length; i++) {
        if(users[i].username == username) {
            return true;
        }
    }
    return false;
}

function getUser(username) {
    for(var i = 0; i < users.length; i++) {
        if(users[i].username == username) {
            return users[i];
        }
    }
    return null;
}

function initSpectator(socket) {
    if(phase != 1) {
        // TODO: Tell them to wait for next game
        io.emit('init', { round: round, MAX_ROUNDS: MAX_ROUNDS });
    } else {
        io.emit('init', { phase: phase, users: users});
        waitingPhase();
    }
}

io.on('connection', function(socket) {
    console.log("Connection!");

    initSpectator(socket);

    socket.on('join-game', function(data) {
        if(phase != 1) {
            warning(socket, "You can only join MathMasters after this game ends.");
            return;
        }
        var username = data.username;
        if(isActiveUser(username)) {
            warning(socket, "You have already joined MathMasters!");
            return;
        }

        // new user
        user = {
            username: username,
            score: 0,
            correct: 0,
            wrong: 0
        }
        users.push(user);
        console.log("Added user to game: " + username);
        socket.emit('username-confirmed', { username: username });
        io.emit('users-update', { users: users });
        waitingPhase();
    });

    socket.on('answer', function(data) {
        if(phase != 2) {
            warning(socket, "The time to submit an answer has ended!");
            return;
        }

        var username = data.username;
        if(!isActiveUser(username)) {
            warning(socket, "You are not in the current game!");
            return;
        }

        // check if they answered already
        for(var i = 0; i < usersWhoAnswered.length; i++) {
            if(usersWhoAnswered[i] == username) {
                warning(socket, "You have already submitted an answer for this round!");
                return;
            }
        }

        usersWhoAnswered.push(username);

        var user = getUser(username);
        var answer = data.answer;
        if(currentAnswer == answer) {
            endRound(user);
            makeNoty(socket, "Your answer was correct!", "success");
            io.emit("make-noty", {text: username + " won the round!", type: "success"});
            socket.emit('answer-response', { correct: true });
        } else {
            updateUser(username, -100, 0, 1);
            makeNoty(socket, "Your answer was incorrect!", "error");
            socket.emit('answer-response', { correct: false });
        }
    });
});
