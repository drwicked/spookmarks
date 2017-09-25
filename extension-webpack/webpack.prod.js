var webpack = require("webpack"),
    path = require("path"),
    fileSystem = require("fs"),
    HtmlWebpackPlugin = require("html-webpack-plugin"),
    WriteFilePlugin = require("write-file-webpack-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");
// load the secrets
var alias = {};
var secretsPath = path.join(__dirname, ("secrets.development.js"));

var fileExtensions = ["jpg", "jpeg", "png", "gif", "eot", "otf", "svg", "ttf", "woff", "woff2"];

if (fileSystem.existsSync(secretsPath)) {
  alias["secrets"] = secretsPath;
}

var options = {
  entry: {
    popup: path.join(__dirname, "src", "js", "popup.js"),
    callback: path.join(__dirname, "src", "js", "callback.js"),
    options: path.join(__dirname, "src", "js", "options.js"),
    background: path.join(__dirname, "src", "js", "background.js")
  },
  output: {
    path: path.join(__dirname, "build"),
    filename: "[name].bundle.js"
  },
  // devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.css$/,
        loader: "style-loader!css-loader",
        exclude: /node_modules/
      },
      {
        test: new RegExp('\.(' + fileExtensions.join('|') + ')$'),
        loader: "file-loader?name=[name].[ext]",
        exclude: /node_modules/
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    alias: alias
  },
  plugins: [
    // expose and write the allowed env vars on the compiled bundle
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production'),
      },
    }),
    new MinifyPlugin({}, {
      comments: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "callback.html"),
      filename: "callback.html",
      chunks: ["callback"]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "popup.html"),
      filename: "popup.html",
      chunks: ["popup"]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "options.html"),
      filename: "options.html",
      chunks: ["options"]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "background.html"),
      filename: "background.html",
      chunks: ["background"]
    }),
    new WriteFilePlugin()
  ]
};


module.exports = options;
