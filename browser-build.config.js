const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: [
    "./src/polyfills.ts",
    "./src/WfsDataParser.ts"
  ],
  output: {
    filename: "wfsDataParser.js",
    path: __dirname + "/browser",
    library: "GeoStylerWfsParser"
  },
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".ts", ".js", ".json"]
  },
  optimization: {
    minimizer: [
      new TerserPlugin()
    ]
  },
  module: {
    rules: [
      // All files with a '.ts'
      {
        test: /\.ts$/,
        include: __dirname + '/src',
        use: [
          {
            loader: require.resolve('ts-loader'),
          },
        ],
      }
    ]
  }
};
