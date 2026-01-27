import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';

interface ProtectedRouteProps {
  adminOnly?: boolean;
  allowAuthor?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  adminOnly = false,
  allowAuthor = false
}) => {
  const { isAuthenticated, currentUser, authReady } = useContext(AuthContext);
  
  if (!authReady) {
    return null;
  }

  // 如果未登录，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // 如果需要管理员权限但当前用户不是管理员，重定向到首页
  if (
    adminOnly
    && !currentUser?.isAdmin
    && !(allowAuthor && currentUser?.isAuthor)
  ) {
    return <Navigate to="/" replace />;
  }
  
  // 如果验证通过，渲染子路由
  return <Outlet />;
};