const { create } = require('domain');
const express = require('express');
const { createServer } = require('http');
const { join } = require('path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const PORT = 3000;

async function main() {
    // open the database file
    const db = await open({
        filename: 'chat.db',
        driver: sqlite3.Database
    });

    // create our 'messages' table (you can ignore the 'client_offset' column for now)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);

    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
        cors: {
            origin: 'http://127.0.0.1:5500', // Đúng với domain của client
            methods: ['GET', 'POST'],
        },
        connectionStateRecovery: {}
    });

    app.get('/', (req, res) => {
        // console.log('PATH: ', join(__dirname, 'public', 'index.html'));
        res.sendFile(join(__dirname, 'public', 'index.html'));
    });

    io.on('connection', async (socket) => {
        console.log('a user connected');
        socket.on('chat message', async (msg, clientOffset, callback) => {
            // console.log('message: ', msg);
            let result;
            try {
                result = await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', msg, clientOffset);
            } catch (e) {
                if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
                    // the message was already inserted, so we notify the client
                    callback();
                } else {
                    // nothing to do, just let the client retry
                }
                return;
            }
            // include the offset with the message
            io.emit('chat message', msg, result.lastID);
            callback();
        });

        if (!socket.recovered) {
            try {
                await db.each('SELECT id, content FROM messages WHERE id > ?',
                    [socket.handshake.auth.serverOffset || 0],
                    (_err, row) => {
                        socket.emit('chat message', row.content, row.id);
                    }
                )
            } catch (e) {

            }
        }
    });

    server.listen(PORT, () => {
        console.log(`server running at http://localhost:${PORT}`);
    });
}

main();

