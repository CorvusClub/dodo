const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const fileSystem = require("fs");
const path = require("path");

const secretsPath = path.join(__dirname, ("secrets.development.js"));

const alias = {};

if (fileSystem.existsSync(secretsPath)) {
  alias["secrets"] = secretsPath;
}

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './build'
  },
  resolve: {alias},
});