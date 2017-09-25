var webpack = require("webpack"),
    config = require("../webpack.prod");

require("./prepare");

delete config.chromeExtensionBoilerplate;

webpack(
  config,
  function (err) { if (err) throw err; }
);
