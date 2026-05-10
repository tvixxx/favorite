import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import router from "./router";
import Antd from "ant-design-vue";
import { message } from "ant-design-vue";
import "./styles/theme-variables.scss";
import "./styles/tokens.scss";
import "./styles/animations.scss";
import "ant-design-vue/dist/reset.css";
import { createPinia } from "pinia";

registerSW({ immediate: true });

const app = createApp(App);
const pinia = createPinia();

app.use(Antd);
app.use(pinia);
app.use(router);

message.config({
  maxCount: 3,
});

app.mount("#app");
