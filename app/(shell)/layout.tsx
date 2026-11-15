import { ShellFrame } from "@/components/shell/ShellFrame";

/** The analysis pages: sidebar, top bar and footer around the page. */
export default function ShellLayout({ children }: LayoutProps<"/">) {
  return <ShellFrame>{children}</ShellFrame>;
}
