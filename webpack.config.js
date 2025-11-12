const path = require('path');

module.exports = {
  target: 'node',
  mode: 'none',
  entry: './extension/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode',
    'fsevents': 'commonjs fsevents' // Optionnel macOS natif, non requis pour fonctionner
    // chokidar, simple-git, uuid: bundlés par webpack pour autonomie complète
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      }
    ]
  },
  devtool: 'nosources-source-map',
  node: {
    __dirname: false,
    __filename: false
  }
};
