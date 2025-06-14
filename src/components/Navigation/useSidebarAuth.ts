
import { useState, useEffect } from "react";

export const useSidebarAuth = () => {
  // No authentication required - universal access
  const userId = "system";
  const userPermissions = null;
  const allowedTabs: string[] = [];
  const isLoading = false;
  
  return {
    userId,
    userPermissions,
    allowedTabs,
    isLoading
  };
};
