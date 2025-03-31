const webpack = require('webpack');

module.exports = function override(config, env) {
  // 添加Node.js核心模块的polyfill
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "buffer": require.resolve("buffer/"),
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "util": require.resolve("util/"),
    "process": require.resolve("process/browser"),
    "path": require.resolve("path-browserify"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify/browser"),
    "events": require.resolve("events/"),
    "assert": false,
    "fs": false,
    "net": false,
    "tls": false,
    "child_process": false
  };

  // 添加插件以支持全局Buffer和process
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process'
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
      }
    })
  );

  return config;
}; 