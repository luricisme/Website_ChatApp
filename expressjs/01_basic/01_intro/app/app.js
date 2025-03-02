const socket = new WebSocket('ws://localhost:3000');

// Nó tự động bắt sự kiện submit và truyền vào hàm sendMessage
document.querySelector('form')
    .addEventListener('submit', sendMessage);

// Hàm gửi tin nhắn đi
function sendMessage(e){
    e.preventDefault();
    const input = document.querySelector('input');
    if(input.value){
        socket.send(input.value);
        input.value = "";
    }
    input.focus();
}

// Lắng nghe tin nhắn ở bên server qua 
socket.addEventListener('message', ({ data }) => {
    const li = document.createElement('li');
    li.textContent = data;
    document.querySelector('ul').appendChild(li);
})