// server.js
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Gpio = require('onoff').Gpio; // Import the onoff library

const http = require('http');
const socketIo = require('socket.io'); 


const app = express();
const port = 3000;
const db = new sqlite3.Database('schedule.db');
const server = http.createServer(app);
const io = socketIo(server);
var manualActive = false;

// Set up the relay pin (GPIO pin 17 for this example)
  // const relay = new Gpio(72, 'out');
  // const relay2 = new Gpio(69, 'out');
//   const relay3 = new Gpio(70, 'out');

 const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize the database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY ,
        day TEXT UNIQUE,
        on_time TEXT,
        off_time TEXT
    );`);
   
    daysOfWeek.forEach((day, index) => {
        db.run(`INSERT OR IGNORE INTO schedule (id, day) VALUES (?,?)`, [index, day]);
    });

    db.all(`SELECT * FROM schedule`, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: err.message });
        }

        console.log(rows)
    })

});

// Serve the main HTML page with current schedule data
app.get('/', (req, res) => {
    db.all(`SELECT * FROM schedule`, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        const schedule = {};
        rows.forEach(row => {
            schedule[row.day] = { on: row.on_time, off: row.off_time };
        });
        res.json(schedule);
    });
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Handle schedule updates
app.post('/schedule', (req, res) => {
    const { day, onTime, offTime } = req.body;
    console.log({ day, onTime, offTime } )

    db.run(`INSERT OR REPLACE INTO schedule (day, on_time, off_time) VALUES (?, ?, ?)`, [day, onTime, offTime], function(err) {
        if (err) {
            console.error(err.message);
            return res.json({ success: false });
        }
                db.all(`SELECT * FROM schedule`, [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return;
            }
            const schedule = {};
            rows.forEach(row => {
                schedule[row.day] = { on: row.on_time, off: row.off_time };
            });
            io.emit('scheduleUpdate', schedule); // Emit the update to all clients
        });
        res.json({ success: true });
    });
});


app.post('/relay/activate', (req, res) => {
    const { day, onTime, offTime } = req.body;

    console.log("active")
     relay.writeSync(1);
     relay2.writeSync(1);
    // relay3.writeSync(1);
    manualActive = true;
    res.json({success: 1})
});

app.post('/relay/deactivate', (req, res) => {
    const { day, onTime, offTime } = req.body;
    console.log("deactivate")
     relay.writeSync(0);
     relay2.writeSync(0);
    // relay3.writeSync(0);

    manualActive = false;
    res.json({success: 1})

});

app.get('/relay/status', (req, res) => { 
    console.log("Status")
     
    if (manualActive){
        res.json({success: 1, is:manualActive});

    } 

    else {
        res.json({success: 0, is:manualActive});
        
    }

});


// Get the current schedule as JSON
app.get('/schedule', (req, res) => {

    db.all(`SELECT * FROM schedule ORDER BY id; `, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        
        const schedule = {};
        rows.forEach(row => {
            schedule[row.day] = { on: row.on_time, off: row.off_time };
        });
         io.emit('scheduleUpdate', schedule);
        res.json(schedule);
    });
});

// Check and control the relay based on the schedule
 

function checkSchedule() {

    if (manualActive){
        return;
    }

    const now = new Date();
    const currentDay = daysOfWeek[now.getDay()]; // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5); // Get HH:MM

    console.log("checking schedule")

   
    db.get(`SELECT * FROM schedule WHERE day = ?`, [currentDay], (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }
        if (row) {
            console.log("row -", row)
            const { on_time, off_time } = row;
            console.log({ on_time, off_time })

            if (on_time <= currentTime && currentTime < off_time) {
                console.log("ON");
                 relay.writeSync(1); // Turn relay ON
                 relay2.writeSync(1);
                 //relay3.writeSync(1);
                 
            } else {
                console.log("OFF");
                 relay.writeSync(0); // Turn relay OFF
                 relay2.writeSync(0);
                 //relay3.writeSync(0);

            }
        }
    });
}

// Check the schedule every minute
setInterval(checkSchedule, 25000);


io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

