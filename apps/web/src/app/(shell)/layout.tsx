import { ShellLayout } from "@/components/shell/ShellLayout";

export default function ShellRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellLayout>{children}</ShellLayout>;
}
