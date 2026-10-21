import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import "./index.css";
import App from "./App";
import Home from "./routes/Home";
import NotFound from "./routes/NotFound";
import TwistedDarkPrivacy from "./routes/TwistedDarkPrivacy";
import TwistedDarkTerms from "./routes/TwistedDarkTerms";
import BloopPrivacy from "./routes/BloopPrivacy";
import BloopTerms from "./routes/BloopTerms";
import ClayzicsPrivacy from "./routes/ClayzicsPrivacy";
import ClayzicsTerms from "./routes/ClayzicsTerms";
import GamePage, { GameHome } from "./routes/GamePage";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        { index: true, element: <Home /> },
        // Old standalone pages now live as sections on the one-page home.
        { path: "projects", element: <Navigate to="/#projects" replace /> },
        { path: "studio", element: <Navigate to="/#studio" replace /> },
        { path: "contact", element: <Navigate to="/#contact" replace /> },
        { path: "twisteddark/privacy", element: <TwistedDarkPrivacy /> },
        { path: "twisteddark/terms", element: <TwistedDarkTerms /> },
        { path: "bloop/privacy", element: <BloopPrivacy /> },
        { path: "bloop/terms", element: <BloopTerms /> },
        { path: "clayzics/privacy", element: <ClayzicsPrivacy /> },
        { path: "clayzics/terms", element: <ClayzicsTerms /> },
        // Each game's pages share its name: /clayzics/play, /clayzics/privacy, /clayzics/terms.
        { path: ":slug/play", element: <GamePage /> },
        { path: ":slug", element: <GameHome /> },
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
