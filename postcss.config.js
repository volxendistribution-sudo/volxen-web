module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    cssnano: {
      preset: 'default',
      discardComments: { removeAll: true },
      minifyFontValues: false,
    },
  },
}