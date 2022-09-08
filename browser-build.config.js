const TerserPlugin = require('terser-webpack-plugin');
require('@babel/polyfill');

module.exports = {
  mode: 'production',
  entry: [
    '@babel/polyfill',
    'whatwg-fetch',
    './src/WfsDataParser.ts'
  ],
  output: {
    filename: 'wfsDataParser.js',
    path: __dirname + '/browser',
    library: 'GeoStylerWfsParser',
    chunkFormat: 'array-push'
  },
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ['.ts', '.js', '.json']
  },
  optimization: {
    minimizer: [
      new TerserPlugin()
    ]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: __dirname + '/src',
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      }
    ]
  }
};
