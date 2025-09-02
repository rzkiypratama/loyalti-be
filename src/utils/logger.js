const ts = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[INFO ] ${ts()}`, ...args),
  warn: (...args) => console.warn(`[WARN ] ${ts()}`, ...args),
  error: (...args) => console.error(`[ERROR] ${ts()}`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEBUG] ${ts()}`, ...args);
    }
  },
};
