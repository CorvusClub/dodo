const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const fileSystem = require("fs");
const path = require("path");

const ZipPlugin = require('zip-webpack-plugin');

const secretsPath = path.join(__dirname, ("secrets.production.js"));

const alias = {};

if (fileSystem.existsSync(secretsPath)) {
  alias["secrets"] = secretsPath;
}

module.exports = merge(common, {
  mode: 'production',
  resolve: {alias},
  plugins: [
    new ZipPlugin({
      path: '../',
      filename: 'build.zip',
    })
  ],
});