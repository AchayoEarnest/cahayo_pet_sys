import { redirect } from "next/navigation";

/**
 * Root route — immediately redirect to the login page.
 * Previously missing, which caused a 404 at localhost:3000
 */
export default function RootPage() {
  redirect("/auth/login");
}
