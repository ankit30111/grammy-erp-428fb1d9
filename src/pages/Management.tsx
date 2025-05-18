
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";

const Management = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect to products page if at the main management route
    if (location.pathname === "/management") {
      navigate("/management/products");
    }
  }, [location.pathname, navigate]);

  return (
    <DashboardLayout>
      <div className="container mx-auto">
        {/* This page acts as a container/router for the management subsections */}
        {/* The actual content will be rendered in the specific management subpages */}
      </div>
    </DashboardLayout>
  );
};

export default Management;
