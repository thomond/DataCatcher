const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

//#region Database
const dbPath = 'received_data.db';
function initializeDatabase() {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
      db.run(`
        CREATE TABLE IF NOT EXISTS received_data (
          id TEXT UNIQUE,
          origin TEXT,
          mime_data TEXT,
          datetime TEXT
        )
      `, (createTableErr) => {
        if (createTableErr) {
          console.error('Error creating table:', createTableErr.message);
        } else {
          console.log('Table "received_data" created or already exists.');
        }
      });
    }
  });
  return db;
}
const db = initializeDatabase();
//#endregion

//#region Express definitions
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.post('/data', (req, res) => {
  const { id, origin, mime_data } = req.body;
  const datetime = new Date().toISOString();

  if (!id || !origin || !mime_data) {
    return res.status(400).json({ error: 'Missing required fields (id, origin, mime_data)' });
  }

  const stmt = db.prepare(`INSERT INTO received_data (id, origin, mime_data, datetime) VALUES (?, ?, ?, ?)`);
  stmt.run(id, origin, mime_data, datetime, function(err) {
    if (err) {
      if (err.errno === 19 && err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: `Data with ID '${id}' already exists` });
      } else {
        console.error('Error inserting data:', err.message);
        return res.status(500).json({ error: 'Failed to save data to the database' });
      }
    }
    console.log(`Data saved to database: ID=${id}, Origin=${origin}, mime_data="${mime_data}", Datetime=${datetime}`);
    res.status(201).json({ message: 'Data received and saved successfully', data: { id, origin, mime_data, datetime } });
  });
  stmt.finalize();
});

app.get('/data', (req, res) => {
  const { origin, date } = req.query;
  let sql = 'SELECT id, origin, mime_data, datetime FROM received_data';
  const params = [];
  const conditions = [];

  if (origin) {
    conditions.push('origin = ?');
    params.push(origin);
  }

  if (date) {
    conditions.push('DATE(datetime) = ?');
    params.push(date); // Assuming 'date' is in 'YYYY-MM-DD' format
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching data:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve data from the database' });
    }
    res.render('data', { rows })
  });
});

app.on('close', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
//#endregion


/* --- Instructions on how to run this app ---
// 1. Make sure you have Node.js and npm (or yarn) installed.
// 2. Install the sqlite3 driver: `npm install express body-parser sqlite3`
// 3. Save this code as a `.js` file (e.g., `server.js`).
// 4. Run the command: `node server.js`
// 5. A file named `received_data.db` will be created in the same directory if it doesn't exist.

// --- How to send a POST request (same as before) ---
// ```bash
// curl -X POST -H "Content-Type: application/json" -d '{"id": "unique123", "origin": "web-app", "text": "This is some text data."}' http://localhost:3000/data
// ```

// ```javascript
// fetch('http://localhost:3000/data', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//   },
//   body: JSON.stringify({
//     id: 'anotherID456',
//     origin: 'mobile-app',
//     text: 'More data to store.',
//   }),
// })
// .then(response => response.json())
// .then(data => console.log(data))
// .catch(error => console.error('Error:', error));
// ```

// --- How to send GET requests ---

// 1. Get all entries:
//    - Open your browser or use curl: `http://localhost:3000/data`

// 2. Filter by origin (e.g., get all entries with origin 'web-app'):
//    - Using curl: `curl http://localhost:3000/data?origin=web-app`
//    - In your browser: `http://localhost:3000/data?origin=web-app`

// 3. Filter by date (assuming date is in 'YYYY-MM-DD' format, e.g., get all entries from '2025-04-09'):
//    - Using curl: `curl http://localhost:3000/data?date=2025-04-09`
//    - In your browser: `http://localhost:3000/data?date=2025-04-09`

// 4. Filter by both origin and date:
//    - Using curl: `curl http://localhost:3000/data?origin=mobile-app&date=2025-04-09`
//    - In your browser: `http://localhost:3000/data?origin=mobile-app&date=2025-04-09`
*/