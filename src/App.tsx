import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { arSA } from "@clerk/localizations";
import { shadcn } from "@clerk/themes";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import AbuAmmarApp from "../abu_ammar_supermarket";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY from the managed Clerk setup.");
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function AuthRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      appearance={{
        theme: shadcn,
        options: {
          logoPlacement: "inside",
          logoLinkUrl: basePath || "/",
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: "#14734e",
          colorForeground: "#0f172a",
          colorMutedForeground: "#64748b",
          colorDanger: "#b91c1c",
          colorBackground: "#ffffff",
          colorInput: "#ffffff",
          colorInputForeground: "#0f172a",
          colorNeutral: "#cbd5e1",
          fontFamily: "Cairo, sans-serif",
          borderRadius: "0.9rem",
        },
        elements: {
          rootBox: "w-full flex justify-center",
          cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-slate-200",
          card: "!shadow-none !border-0 !bg-transparent !rounded-none",
          footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
          headerTitle: "text-slate-900",
          headerSubtitle: "text-slate-600",
          formFieldLabel: "text-slate-800",
          footerActionLink: "text-emerald-700",
          footerActionText: "text-slate-600",
          dividerText: "text-slate-500",
          socialButtonsBlockButtonText: "text-slate-800",
          formButtonPrimary: "bg-emerald-700 hover:bg-emerald-800",
          formFieldInput: "bg-white border-slate-200 text-slate-900",
          alertText: "text-slate-800",
        },
      }}
      localization={arSA}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/sign-in/*?">
          <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-10" dir="rtl">
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </main>
        </Route>
        <Route path="/sign-up/*?">
          <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-10" dir="rtl">
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          </main>
        </Route>
        <Route path="/" component={AbuAmmarApp} />
        <Route component={AbuAmmarApp} />
      </Switch>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthRoutes />
    </WouterRouter>
  );
}
