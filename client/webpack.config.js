// @ts-check



const path = require("path")
const TerserPlugin = require("terser-webpack-plugin")
const CopyPlugin = require("copy-webpack-plugin")

/**@type {import('webpack').Configuration}*/
const config = {
  target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  
  // Enable webpack caching for faster builds
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    }
  },

  entry: {
    extension: "./src/extension.ts",
    jsWorkerEntry: "./src/notebooks/jsWorkerEntry.ts"
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]"
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode" // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [".ts", ".js"],
    // Prefer the `module` (ESM) entry over `main` (often UMD/CJS) when a
    // package publishes both. Webpack 5 with `target: "node"` defaults to
    // CJS resolution, which exposes a UMD shim with dynamic `require(...)`
    // calls in `docx@9.7.1`'s `dist/index.cjs` (line 27991) that webpack
    // cannot statically analyse — build fails with 1 error.
    mainFields: ["module", "main"],
    conditionNames: ["import", "node", "default"],
    alias: {
      // Direct alias for `docx` — the conditionNames override above is not
      // sufficient because docx's `exports` field maps `require` to the
      // problematic `index.cjs`. Resolve the package's CJS entry first,
      // then swap to the sibling ESM file. Survives docx version bumps and
      // works under both pnpm's symlinked layout and npm's hoisted layout.
      // NOTE: this whole webpack config is being replaced by a faster
      // bundler in a follow-up PR — these workarounds will go with it.
      docx: path.join(
        path.dirname(require.resolve("docx", { paths: [__dirname] })),
        "index.mjs"
      )
    }
  },
  watchOptions: {
    ignored: /node_modules|out/
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: "media", 
          to: "media",
          noErrorOnMissing: true,
          force: true,
          priority: 0
        },
        {
          from: "../DOCUMENTATION.md",
          to: "media/DOCUMENTATION.md",
          noErrorOnMissing: false,
          force: true
        }
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /.*\.test\.(d\.)[tj]s/, /media/],
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true
            }
          }
        ]
      }, {
        test: /\.(node)$/i,
        use: [
          {
            loader: 'file-loader',
          }
        ]
      },
      // Handle ESM modules that use .js extensions in imports (like @modelcontextprotocol/sdk)
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  }
}

/**@type {import('webpack').Configuration}*/
const prodConfig = {
  ...config,
  name: "production",
  mode: "production",
  optimization: {
    minimizer: [
      compiler => {
        new TerserPlugin({
          parallel: true,
          exclude: /media\/.*\.js$/,  // Exclude media JS files from minification
          terserOptions: {
            keep_classnames: true
          }
        }).apply(compiler)
      }
    ]
  }
}
/**@type {import('webpack').Configuration}*/
const devConfig = {
  ...config,
  name: "development",
  mode: "development",
  infrastructureLogging: { level: "verbose" }
}
module.exports = [devConfig, prodConfig]
