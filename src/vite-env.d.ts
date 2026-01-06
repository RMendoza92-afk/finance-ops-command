/// <reference types="vite/client" />

// TTF font files imported with ?url suffix
declare module '*.ttf?url' {
  const src: string;
  export default src;
}

