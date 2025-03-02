const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3500;
const ADMIN = 'Admin';

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const expressServer = app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
});

// State - Dùng mảng để lưu --> Nếu có database thì lưu vào database
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray;
    }
}

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
});

io.on('connection', socket => {
    console.log(`User ${socket.id} connected`);

    // Upon connection - only to user
    socket.emit('message', buildMsg(ADMIN, 'Welcome to Chat App!'));

    socket.on('enterRoom', ({ name, room }) => {
        // Leave previous room
        const prevRoom = getUser(socket.id)?.room;
        if (prevRoom) {
            socket.leave(prevRoom);
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`));
        }

        const user = activateUser(socket.id, name, room);

        // Cannot update previous room users list until after the state update in activate user
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }

        // Join room
        socket.join(user.room);

        // To user who joined
        socket.emit('message', buildMsg(ADMIN, `You have joined the ${user.room} chat room`));

        // To everyone else
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`));

        // Update usr list for room
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        // Update rooms list for everyone
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    });

    // When user disconnects - to all others
    socket.on('disconnect', () => {
        const user = getUser(socket.id);
        userLeavesApp(socket.id);
        if(user){
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`));
            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })
            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`User ${socket.id} disconnected`);
    });

    // Listening for a message event
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room;
        if(room){
            io.to(room).emit('message', buildMsg(name, text));
        }
    });

    // Listen for activity
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room;
        if(room){
            socket.broadcast.to(room).emit('activity', name);
        }
    })
});

// HÀM XÂY DỰNG TIN NHẮN GỬI ĐI 
function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    }
}

// NGƯỜI DÙNG ĐANG ONLINE
function activateUser(id, name, room) {
    const user = { id, name, room };
    // Xử lý mảng thêm vào để nó không trùng lặp người dùng 
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])
    return user;
}

// CẬP NHẬT LẠI DANH SÁCH NGƯỜI DÙNG ONLINE NẾU CÓ NGƯỜI RỜI KHỎI APP
function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

// LẤY RA NGƯỜI DÙNG THEO ID
function getUser(id) {
    return UsersState.users.find(user => user.id === id);
}

// LẤY RA NGƯỜI DÙNG ĐANG CÓ TRONG PHÒNG
function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room);
}

// LẤY RA HẾT TẤT CẢ CÁC PHÒNG ĐANG HOẠT ĐỘNG
function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)));
}



