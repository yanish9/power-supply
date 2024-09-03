// server.js
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Gpio = require('onoff').Gpio; // Import the onoff library

const app = express();
const port = 3000;
const db = new sqlite3.Database('schedule.db');

// Set up the relay pin (GPIO pin 17 for this example)
const relay = new Gpio(131, 'out');
 const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize the database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS schedule (
        day TEXT PRIMARY KEY,
        on_time TEXT,
        off_time TEXT
    )`);
   
    daysOfWeek.forEach(day => {
        db.run(`INSERT OR IGNORE INTO schedule (day) VALUES (?)`, [day]);
    });
});

// Serve the main HTML page with current schedule data
app.get('/', (req, res) => {
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
        res.json({ success: true });
    });
});

// Get the current schedule as JSON
app.get('/schedule', (req, res) => {

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
});

// Check and control the relay based on the schedule
function checkSchedule() {
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
            const { on_time, off_time } = row;
            if (currentTime === on_time) {
                relay.writeSync(1); // Turn relay ON
            } else if (currentTime === off_time) {
                relay.writeSync(0); // Turn relay OFF
            }
        }
    });
}

// Check the schedule every minute
setInterval(checkSchedule, 60000);

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
