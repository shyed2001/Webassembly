// In: prime_distributed_projectPrlCc1B V5(10K)/coordinator_server.js
module.exports = {
  apps : [{
    name   : "coordinator",
    script : "coordinator_server.js",
    // ⬇️ *** CHANGE THIS LINE TO FALSE *** ⬇️
    watch  : false,
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