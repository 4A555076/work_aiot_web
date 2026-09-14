import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import FireRecordPage from "@/pages/FireRecord";
import MissingHourPage from "@/pages/MissingHour";
import AlarmOverviewPage from "@/pages/AlarmOverview";
import DecommissionedStation from "@/pages/DecommissionedStation";
import InspectionEntry from "@/pages/InspectionEntry";
import InspectionReport from "@/pages/InspectionReport";
import SensorReplacementEntry from "@/pages/SensorReplacementEntry";
import SensorReplacementReport from "@/pages/SensorReplacementReport";
import QaqcEntry from "@/pages/QaqcEntry";
import QaqcReport from "@/pages/QaqcReport";
import StationHealth from "@/pages/StationHealth";
import ProjectScore from "@/pages/ProjectScore";
import Project from "@/pages/Project";
import Dashboard from "@/pages/Dashboard";
import Compare from "@/pages/Compare";

export const router = createBrowserRouter(
  [
    {
      element: <ProtectedRoute />, 
      children: [
        {
          path: "/",
          element: <AppLayout />,
          children: [
            { index: true, element: <Home /> },
            { path: "/fire-report", element: <FireRecordPage /> },
            { path: "/device-offline", element: <MissingHourPage /> },
            { path: "/station-anomaly", element: <AlarmOverviewPage /> },
            { path: "/setting/station/offline", element: <DecommissionedStation /> },
            { path: "/UpdateParams", element: <InspectionEntry /> },
            { path: "/ReportExcel", element: <InspectionReport /> },
            { path: "/station-sensor-replacement", element: <SensorReplacementEntry /> },
            { path: "/station/sensor-replacement-history", element: <SensorReplacementReport /> },
            { path: "/Qaqc/test-input", element: <QaqcEntry /> },
            { path: "/Qaqc/calculation-output", element: <QaqcReport /> },
            { path: "/station/health/monthly", element: <StationHealth /> },
            { path: "/project/health", element: <ProjectScore /> },
            { path: "/project/all", element: <Project /> },
            { path: "/project/single-site-dashboard", element: <Dashboard /> },
            { path: "/project/site-comparison", element: <Compare /> },
          ],
        },
      ],
    },
    {
      path: "/login",
      element: <Login />,
    },
  ],
  {
    basename: "/aiot",
  }
);