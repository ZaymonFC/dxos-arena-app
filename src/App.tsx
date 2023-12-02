import {
  GenericFallback,
  ResetDialog,
  ServiceWorkerToastContainer,
  ThemeProvider,
  appkitTranslations,
} from "@dxos/react-appkit";
import { ClientProvider, Config, Defaults, Dynamics, Local } from "@dxos/react-client";
import React from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ChessGame } from "./ChessGame";
import { ErrorBoundary } from "./ErrorBoundary";
import { types } from "./proto";
import { Nav } from "./Nav";
import { GradientBackground } from "./GradientBackground";

// Dynamics allows configuration to be supplied by the hosting KUBE.
const config = async () => new Config(await Dynamics(), Local(), Defaults());

export const App = () => {
  const serviceWorker = useRegisterSW();

  const router = createBrowserRouter([
    {
      path: "/",
      element: <ChessGame />,
    },
  ]);

  return (
    <ThemeProvider
      appNs="arena-app"
      resourceExtensions={[appkitTranslations]}
      fallback={<GenericFallback />}
    >
      <ErrorBoundary fallback={({ error }) => <ResetDialog error={error} config={config} />}>
        <ClientProvider
          config={config}
          fallback={GenericFallback}
          onInitialized={async (client) => {
            client.addTypes(types);

            const searchParams = new URLSearchParams(location.search);
            if (!client.halo.identity.get() && !searchParams.has("deviceInvitationCode")) {
              await client.halo.createIdentity();
            }
          }}
        >
          <Nav />
          <RouterProvider router={router} />
          <ServiceWorkerToastContainer {...serviceWorker} />
          <GradientBackground />
        </ClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
};
