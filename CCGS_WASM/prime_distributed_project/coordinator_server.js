import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
console.log('Coordinator server running on ws://localhost:8080');

const N = 400000000; // Using 100M for a more substantial test
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

function updateDirectorProgress(taskId, count, totalCompleted) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'progress', taskId, count, totalCompleted }));
    }
}

function notifyDirectorComplete(totalPrimes) {
     if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'complete', totalPrimes }));
    }
}


function initializeTasks() {
    taskQueue.length = 0;
    results = new Array(TOTAL_TASKS).fill(null);
    const chunkSize = Math.floor(N / TOTAL_TASKS);
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const effectiveStart = (i === 0 && start === 1) ? 2 : start;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start: effectiveStart, end });
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
                worker.assignedTask = task;
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
        
        switch (data.type) {
            case 'registerDirector':
                directorSocket = ws;
                console.log('Director has connected.');
                logToDirector('👑 You are the Director. Ready to start.');
                break;

            case 'registerWorker':
                ws.isBusy = false;
                workers.add(ws);
                console.log(`Worker registered. Total workers: ${workers.size}`);
                logToDirector(`A new worker connected. Total workers: ${workers.size}`);
                if (isRunning) assignTaskToAvailableWorker();
                break;

            case 'startComputation':
                if (isRunning) {
                    logToDirector('Computation is already running.');
                    return;
                }
                console.log('Director started the computation.');
                isRunning = true;
                initializeTasks();
                workers.forEach(worker => assignTaskToAvailableWorker());
                break;
            
            case 'result':
                ws.isBusy = false;
                ws.assignedTask = null;
                results[data.taskId] = data.count;
                
                const completed = results.filter(r => r !== null).length;
                updateDirectorProgress(data.taskId, data.count, completed);

                if (completed === TOTAL_TASKS) {
                    const totalPrimes = results.reduce((sum, count) => sum + count, 0);
                    notifyDirectorComplete(totalPrimes);
                    isRunning = false;
                } else {
                    assignTaskToAvailableWorker();
                }
                break;

            case 'error':
                ws.isBusy = false; 
                const failedTask = ws.assignedTask;
                ws.assignedTask = null;

                if (failedTask && failedTask.taskId === data.taskId) {
                    console.log(`Worker reported an error on task ${failedTask.taskId}. Returning it to the queue.`);
                    logToDirector(`Worker crashed on task ${failedTask.taskId}. Re-queuing...`);
                    taskQueue.unshift(failedTask);
                    assignTaskToAvailableWorker();
                }
                break;
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

            if (ws.assignedTask) {
                console.log(`Worker was holding task ${ws.assignedTask.taskId}. Returning it to the queue.`);
                logToDirector(`A worker disconnected with task ${ws.assignedTask.taskId}. Re-queuing...`);
                taskQueue.unshift(ws.assignedTask);
                assignTaskToAvailableWorker();
            }
        }
    });
});