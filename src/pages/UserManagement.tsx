
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { UserManagementPage } from "@/components/UserManagement/UserManagementPage";

const UserManagement = () => {
  return (
    <DashboardLayout>
      <UserManagementPage />
    </DashboardLayout>
  );
};

export default UserManagement;
