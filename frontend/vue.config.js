const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    devtool: "source-map", // Enable source maps for debugging
  },
  // Additional configuration to ensure development-friendly settings
  chainWebpack: (config) => {
    if (process.env.NODE_ENV === "development") {
      config.optimization.minimize(false);
    }
  },
});
