// signaling_server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
console.log('Signaling server running on ws://localhost:8080');

// A simple way to manage clients.
const clients = new Set();

wss.on('connection', ws => {
    console.log('Client connected');
    clients.add(ws);

    ws.on('message', message => {
        // When a message is received, broadcast it to all other clients.
        // This is how peers exchange WebRTC connection info.
        for (const client of clients) {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message);
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});