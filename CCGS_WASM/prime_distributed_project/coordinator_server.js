import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
console.log('Coordinator server running on ws://localhost:8080');

const N = 100_000_000;
const TOTAL_TASKS = 10;

let directorSocket = null;
const workers = new Set();
const taskQueue = [];
let results = [];
let isRunning = false;

function logToDirector(message) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'log', message }));
    }
}

function initializeTasks() {
    taskQueue.length = 0;
    results = new Array(TOTAL_TASKS).fill(null);
    const chunkSize = Math.floor(N / TOTAL_TASKS);
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start, end });
    }
    logToDirector(`Task queue created with ${taskQueue.length} tasks.`);
}

function assignTaskToAvailableWorker() {
    if (taskQueue.length === 0) return;

    for (const worker of workers) {
        if (!worker.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                worker.isBusy = true;
                worker.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to a worker.`);
            }
            break; 
        }
    }
}

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        
        if (data.type === 'registerDirector') {
            directorSocket = ws;
            console.log('Director has connected.');
            logToDirector('👑 You are the Director. Ready to start.');
            return;
        }

        if (data.type === 'registerWorker') {
            ws.isBusy = false;
            workers.add(ws);
            console.log(`Worker registered. Total workers: ${workers.size}`);
            logToDirector(`A new worker connected. Total workers: ${workers.size}`);
            if (isRunning) assignTaskToAvailableWorker();
            return;
        }

        if (data.type === 'startComputation') {
            if (isRunning) {
                logToDirector('Computation is already running.');
                return;
            }
            console.log('Director started the computation.');
            isRunning = true;
            initializeTasks();
            workers.forEach(worker => assignTaskToAvailableWorker());
            return;
        }
        
        if (data.type === 'result') {
            ws.isBusy = false;
            results[data.taskId] = data.count;
            logToDirector(`Result for task ${data.taskId} received: ${data.count}`);
            
            const completed = results.filter(r => r !== null).length;
            if (completed === TOTAL_TASKS) {
                const totalPrimes = results.reduce((sum, count) => sum + count, 0);
                logToDirector(`\n🎉 ALL TASKS COMPLETE! Total Primes: ${totalPrimes.toLocaleString()}`);
                isRunning = false;
            } else {
                assignTaskToAvailableWorker();
            }
        }
    });

    ws.on('close', () => {
        if (ws === directorSocket) {
            console.log('Director disconnected.');
            directorSocket = null;
        } else {
            workers.delete(ws);
            console.log(`Worker disconnected. Total workers: ${workers.size}`);
            logToDirector(`A worker disconnected. Total workers: ${workers.size}`);
        }
    });
});