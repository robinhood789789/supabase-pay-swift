import { Navigate } from "react-router-dom";

export default function WebhookSetup() {
  return <Navigate to="/settings?tab=webhooks" replace />;
}
