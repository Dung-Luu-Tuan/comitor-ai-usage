/**
 * Tailwind v4 chỉ cần MỘT plugin PostCSS. Không có `autoprefixer`, không có `postcss-import`
 * — v4 đã gộp cả hai vào trong.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
