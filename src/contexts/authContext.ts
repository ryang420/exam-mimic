import { createContext } from "react";

// 用户类型定义
export interface User {
  id: string;
  username: string;
  password: string; // 在实际应用中应该存储密码哈希
  isAdmin: boolean;
  createdAt: string;
}

// 认证上下文类型定义
interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  setIsAuthenticated: (value: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  login: (username: string, password: string) => boolean;
  register: (username: string, password: string, isAdmin?: boolean) => boolean;
  logout: () => void;
  getAllUsers: () => User[];
}

// 创建默认管理员用户（如果不存在）
const createDefaultAdmin = () => {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const adminExists = users.some((user: User) => user.isAdmin);
  
  if (!adminExists) {
    const adminUser: User = {
      id: 'admin-' + Date.now(),
      username: 'admin',
      password: 'admin123', // 简单密码用于演示
      isAdmin: true,
      createdAt: new Date().toISOString()
    };
    users.push(adminUser);
    localStorage.setItem('users', JSON.stringify(users));
    return adminUser;
  }
  return null;
};

// 创建默认管理员（如果需要）
createDefaultAdmin();

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  setIsAuthenticated: () => {},
  setCurrentUser: () => {},
  login: () => false,
  register: () => false,
  logout: () => {},
  getAllUsers: () => []
});