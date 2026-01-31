// pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import ConsoleShell from "@/components/ConsoleShell";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const path = router.pathname || "";
  const isConsole = path === "/console" || path.startsWith("/console/");

  if (isConsole) {
    // Optional: allow pages to override the header title via pageProps.title
    const title = (pageProps as any)?.title || "Console";

    return (
      <ConsoleShell title={title}>
        <Component {...pageProps} />
      </ConsoleShell>
    );
  }

  return <Component {...pageProps} />;
}
