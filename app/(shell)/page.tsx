import { redirect } from "next/navigation";

/** Trang chủ của sản phẩm: chuyển thẳng vào quản lý AI. */
export default function HomePage() {
  redirect("/ai-usage");
}
