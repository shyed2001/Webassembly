const startBtn = document.getElementById('start-btn');
const logDiv = document.getElementById('log');
const socket = new WebSocket('ws://localhost:8080');

const log = (message) => logDiv.textContent += message + '\n';

socket.onopen = () => {
    log('✅ Connected. Registering as Director...');
    socket.send(JSON.stringify({ type: 'registerDirector' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'log') {
        log(data.message);
    }
};

startBtn.onclick = () => {
    log('Sending command to start computation...');
    socket.send(JSON.stringify({ type: 'startComputation' }));
};
