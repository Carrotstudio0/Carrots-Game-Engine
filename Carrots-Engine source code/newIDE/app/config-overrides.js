// This file customizes webpack configuration for react-app-rewired.
const path = require('path');

module.exports = {
  webpack: function override(config, env) {
    const extensionsSourcePath = path.resolve(__dirname, '..', '..', 'Extensions');

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
    config.ignoreWarnings = [
      /Failed to parse source map/,
      /Critical dependency: the request of a dependency is an expression/,
    ];

    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      // TypeScript's browser bundle optionally probes Node's perf_hooks module.
      // It is not needed in the editor/browser runtime.
      perf_hooks: false,
    };
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // During editor development, JS extension declarations are required directly
      // by BrowserJsExtensionsLoader. Resolving them from the source Extensions folder
      // avoids transient ENOENT errors when the generated GDJS-for-web-app-only package
      // is temporarily stale or being rebuilt in node_modules.
      'GDJS-for-web-app-only/Runtime/Extensions': extensionsSourcePath,
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

    config.resolve.plugins = (config.resolve.plugins || []).map(plugin => {
      if (plugin && plugin.constructor && plugin.constructor.name === 'ModuleScopePlugin') {
        plugin.allowedPaths = [
          ...(plugin.allowedPaths || []),
          extensionsSourcePath,
        ];
      }
      return plugin;
    });

    if (process.argv.includes('--stats-children')) {
      config.stats = {
        ...(typeof config.stats === 'object' ? config.stats : {}),
        children: true,
        errorDetails: true,
      };
    }

    return config;
  },

  jest: function(config) {
    config.moduleNameMapper = {
      ...(config.moduleNameMapper || {}),
      '^GDJS-for-web-app-only/Runtime/Extensions/(.*)$':
        '<rootDir>/../../Extensions/$1',
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

  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      const localGdjsRuntimePath = path.resolve(__dirname, 'resources', 'GDJS');
      const localGdjsStaticEntry = {
        directory: localGdjsRuntimePath,
        publicPath: '/__local_gdjs__',
        watch: true,
      };

      const staticEntries = Array.isArray(config.static)
        ? config.static
        : config.static
          ? [config.static]
          : [];
      const hasLocalGdjsStaticEntry = staticEntries.some(
        entry =>
          entry &&
          typeof entry === 'object' &&
          entry.publicPath === localGdjsStaticEntry.publicPath
      );
      if (!hasLocalGdjsStaticEntry) {
        staticEntries.push(localGdjsStaticEntry);
      }
      config.static = staticEntries;

      return config;
    };
  },
};
