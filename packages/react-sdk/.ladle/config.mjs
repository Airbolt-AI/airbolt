export default {
  stories: "src/**/*.stories.{js,jsx,ts,tsx,mdx}",
  viteConfig: ".ladle/vite.config.mjs",
  addons: {
    theme: {
      enabled: true,
      defaultState: "auto"
    },
    mode: {
      enabled: true,
      defaultState: "full"
    },
    rtl: {
      enabled: true,
      defaultState: false
    },
    lazyLoad: {
      enabled: false
    },
    source: {
      enabled: true,
      defaultState: false
    },
    a11y: {
      enabled: true
    },
    width: {
      enabled: true,
      options: {
        small: 360,
        medium: 768,
        large: 1024,
      },
      defaultState: 0
    }
  }
};