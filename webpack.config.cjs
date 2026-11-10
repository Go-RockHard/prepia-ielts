const fs = require('node:fs')
const path = require('node:path')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = (_env, argv) => {
  const mode = argv.mode ?? 'development'
  const envFiles = [
    `.env.${mode}.local`,
    '.env.local',
    `.env.${mode}`,
    '.env',
  ]

  for (const file of envFiles) {
    const filePath = path.resolve(__dirname, file)
    if (fs.existsSync(filePath)) {
      process.loadEnvFile(filePath)
    }
  }

  return {
    mode,
    entry: './src/main.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'assets/[name].[contenthash].js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                ['@babel/preset-env', { modules: false }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            { loader: 'css-loader', options: { importLoaders: 1 } },
            'postcss-loader',
          ],
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'import.meta.env': JSON.stringify({
          DEV: mode === 'development',
          PROD: mode === 'production',
          MODE: mode,
          BASE_URL: '/',
          VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY ?? '',
          VITE_GEMINI_LIVE_MODEL: process.env.VITE_GEMINI_LIVE_MODEL ?? '',
        }),
      }),
      new HtmlWebpackPlugin({
        template: './index.html',
        scriptLoading: 'module',
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: path.resolve(__dirname, 'public'), to: '.' }],
      }),
    ],
    devServer: {
      host: '127.0.0.1',
      port: 5173,
      hot: true,
      historyApiFallback: true,
      static: {
        directory: path.resolve(__dirname, 'public'),
        publicPath: '/',
      },
      client: {
        overlay: true,
      },
    },
    devtool: mode === 'development' ? 'eval-cheap-module-source-map' : false,
  }
}
