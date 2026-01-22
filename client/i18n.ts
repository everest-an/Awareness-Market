// i18n initialization for Awareness Market
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./i18n/en.json";
import zh from "./i18n/zh.json";

const savedLanguage = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
const browserLanguage = typeof navigator !== "undefined" && navigator.language.startsWith("zh") ? "zh" : "en";

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        zh: { translation: zh },
    },
    lng: savedLanguage || browserLanguage || "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
});

export default i18n;
