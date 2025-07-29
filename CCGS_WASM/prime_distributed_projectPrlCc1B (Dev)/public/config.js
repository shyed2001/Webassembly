// /public/config.js

export const config = {
  // -- Network Settings --
  // Use your computer's current IP address or its hostname.
  // Using the IP address is often more reliable on home networks.
  WEBSOCKET_IP: '192.168.1.112',
  WEBSOCKET_PORT: 8080,

  // -- Computation Parameters --
  // The upper limit for the prime number search.
  N: 1000000,
  // The total number of tasks to divide the work into.
  TOTAL_TASKS: 2500,
  
  // -- System Behavior Settings --
  // Time in milliseconds before a non-responsive worker is disconnected. (30 seconds)
  HEARTBEAT_INTERVAL: 30000,
  // Time in milliseconds before a task is considered timed out and re-queued. (3 minutes)
  TASK_TIMEOUT: 180000,
};

// This line automatically builds the full WebSocket URL for the clients.
config.WEBSOCKET_URL = `ws://${config.WEBSOCKET_IP}:${config.WEBSOCKET_PORT}`;