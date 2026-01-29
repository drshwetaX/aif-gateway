import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import ConsoleShell from "@/components/ConsoleShell";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter(); // ✅ missing line
  const isConsole = router.pathname.startsWith("/console");

  if (isConsole) {
    return (
      <ConsoleShell title={(pageProps as any)?.title || "Console"}>
        <Component {...pageProps} />
      </ConsoleShell>
    );
  }

  return <Component {...pageProps} />;
}
