import next from "eslint-config-next/core-web-vitals";

const config = [
  ...(Array.isArray(next) ? next : [next]),
  {
    ignores: [".next/**", "node_modules/**", "data/**"],
  },
];

export default config;
