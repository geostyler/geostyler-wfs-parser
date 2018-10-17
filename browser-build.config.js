const webpack = require("webpack");
require("@babel/polyfill");
require("whatwg-fetch");

module.exports = {
  entry: [
    '@babel/polyfill',
    'whatwg-fetch',
    './src/WfsDataParser.ts'
  ],
  output: {
    filename: "wfsDataParser.js",
    path: __dirname + "/browser",
    library: "GeoStylerWfsParser"
  },
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".ts", ".tsx", ".js", ".json"]
  },
  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      {
        test: /\.ts$/,
        include: /src/,
        loader: "awesome-typescript-loader"
      },
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin(),
  ]
};
