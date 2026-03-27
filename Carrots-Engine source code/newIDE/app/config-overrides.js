// This file customizes webpack configuration for react-app-rewired.
const webpack = require('webpack');

module.exports = {
  webpack: function override(config, env) {
    const workerRule = {
      test: /\.worker(\.(js|ts))?$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: '[name].[contenthash].worker.js',
          esModule: true,
        },
      },
    };

    const oneOfContainerRule = config.module.rules.find(
      rule => Array.isArray(rule.oneOf)
    );
    if (oneOfContainerRule) {
      oneOfContainerRule.oneOf.unshift(workerRule);
    } else {
      config.module.rules.unshift(workerRule);
    }

    // A lot of packages we use in node_modules trigger source map warnings
    // but it is not a blocking issue, so we ignore them.
    config.ignoreWarnings = [
      /Failed to parse source map/,
      /the request of a dependency is an expression/,
    ];

    // TypeScript internally tries to load Node's "perf_hooks".
    // It's not available in browser, so we explicitly disable it.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      perf_hooks: false,
    };

    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^perf_hooks$/,
      })
    );

    return config;
  },

  jest: function(config) {
    config.transformIgnorePatterns = [
      '<rootDir>/node_modules/(?!react-markdown|unified|remark-parse|mdast-util-from-markdown|micromark|decode-named-character-reference|remark-rehype|trim-lines|hast-util-whitespace|remark-gfm|mdast-util-gfm|mdast-util-find-and-replace|mdast-util-to-markdown|markdown-table|is-plain-obj)',
    ];

    return config;
  },
};
