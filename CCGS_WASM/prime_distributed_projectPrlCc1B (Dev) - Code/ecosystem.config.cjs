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
    script : "python",
    args   : "-m http.server 8008 --bind 0.0.0.0",
    cwd    : "./public",
    watch  : false,
    env    : {
      NODE_ENV: "development",
    }
  }]
}