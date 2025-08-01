// ecosystem.config.cjs
// This file is used by PM2 to manage the coordinator server process.
// It specifies the application configuration, including the script to run,
// the user to run it as, and the environment variables.
// It also enables cluster mode for full parallelism, allowing multiple instances
// of the coordinator server to run simultaneously for better performance.
// The log paths are specified to ensure that output and error logs are stored
// in a specific directory for easy access and monitoring.
// file path: prime_distributed_projectPrlCc1B%20V5%2810K%29/ecosystem.config.cjs

// This is the final, correct version of ecosystem.config.cjs
module.exports = {
  apps : [{
    name        : "coordinator",
    script      : "coordinator_server.js",
    instances   : "max", // Use all available CPU cores
    exec_mode   : "cluster",
    watch       : false,
    env: {
      "NODE_ENV": "production",
    }
  }]
}



/* * PM2 Configuration for Coordinator Server
module.exports = {
  apps : [{
    name      : "coordinator",
    script    : "coordinator_server.js",
    watch     : false,
    user      : "www-data",
    
    // These lines enable cluster mode for full parallelism
    instances : "max",
    exec_mode : "cluster",
    // --- ADD THESE LINES TO SPECIFY LOG PATHS ---
    output    : "/var/log/coordinator/out.log",
    error     : "/var/log/coordinator/error.log",
    env       : {
      NODE_ENV: "production", 
    }
  }]
}
*/

/* PM2 Configuration for Coordinator Server
This configuration file is used to manage the coordinator server process using PM2.
module.exports = {
  apps : [{
    name   : "coordinator",
    script : "coordinator_server.js",
    // ⬇️ *** CHANGE THIS LINE TO FALSE *** ⬇️
    watch  : false,
        // Add the user directive for correct file permissions
    user   : "www-data", 
        // --- ADD THESE TWO LINES ---
    instances : "max",
    exec_mode : "cluster",
    env    : {
      NODE_ENV: "development",
    }
  }, {
    name   : "http-server",
    script : "python3" || "python",
    //args   : "-m http.server 8008 --bind 0.0.0.0",
    args   : "-m http.server 8008 --bind 127.0.0.1",
    // Note: We bind to 127.0.0.1 now because only Nginx will talk to this server, not the public internet.
    cwd    : "./public",
    watch  : false,
    env    : {
      NODE_ENV: "development",
    }
  }]
}
  */