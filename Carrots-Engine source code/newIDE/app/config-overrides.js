// This file customizes webpack configuration for react-app-rewired.
const path = require('path');

module.exports = {
  webpack: function override(config, env) {
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: '[name].[contenthash].worker.js',
        },
      },
    });

    // A lot of packages we use in node_modules trigger source map warnings
    // but it is not a blocking issue, so we ignore them.
    config.ignoreWarnings = [/Failed to parse source map/];

    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'pixi.js-original$': require.resolve('pixi.js'),
      'pixi.js$': path.resolve(__dirname, 'src/Utils/PixiCompat/pixi.js'),
      'pixi.js-legacy$': path.resolve(
        __dirname,
        'src/Utils/PixiCompat/pixi.js'
      ),
      'tiny-lru-original$': require.resolve('tiny-lru'),
      // Pixi v8 expects tiny-lru.lru(...) in some bundled CJS paths.
      // This wrapper normalizes ESM/CJS shapes and avoids runtime bootstrap crashes.
      'tiny-lru$': path.resolve(
        __dirname,
        'src/Utils/PixiCompat/tiny-lru-compat.js'
      ),
    };

    return config;
  },

  jest: function(config) {
    config.moduleNameMapper = {
      ...(config.moduleNameMapper || {}),
      '^pixi\\.js$': '<rootDir>/src/Utils/PixiCompat/pixi.js',
      '^pixi\\.js-legacy$': '<rootDir>/src/Utils/PixiCompat/pixi.js',
      '^pixi\\.js-original$': require.resolve('pixi.js'),
      '^tiny-lru$': '<rootDir>/src/Utils/PixiCompat/tiny-lru-compat.js',
      '^tiny-lru-original$': require.resolve('tiny-lru'),
    };

    config.transformIgnorePatterns = [
      '<rootDir>/node_modules/(?!react-markdown|unified|remark-parse|mdast-util-from-markdown|micromark|decode-named-character-reference|remark-rehype|trim-lines|hast-util-whitespace|remark-gfm|mdast-util-gfm|mdast-util-find-and-replace|mdast-util-to-markdown|markdown-table|is-plain-obj)',
    ];

    return config;
  },
};
