// signaling_server.js (Improved Version)
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
console.log('Signaling server running on ws://localhost:8080');

const clients = new Set();
let director = null; // Variable to store the director's WebSocket connection

wss.on('connection', ws => {
    clients.add(ws);
    console.log(`Client connected. Total clients: ${clients.size}`);

    // If a director already exists, immediately notify the new client.
    if (director) {
        ws.send(JSON.stringify({ type: 'directorExists' }));
    }

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'iamDirector') {
            // A client has declared themselves the director
            director = ws;
            console.log('A client became the Director.');
            // Notify all OTHER clients that a director has been chosen
            for (const client of clients) {
                if (client !== ws) {
                    client.send(JSON.stringify({ type: 'directorExists' }));
                }
            }
        } else {
            // If it's a normal WebRTC message, just broadcast it
            for (const client of clients) {
                if (client !== ws && client.readyState === ws.OPEN) {
                    client.send(message);
                }
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected.');
        clients.delete(ws);
        // If the director disconnected, reset the state
        if (ws === director) {
            director = null;
            console.log('The Director has disconnected.');
        }
    });
});