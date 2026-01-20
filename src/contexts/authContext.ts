import { createContext } from "react";

// 用户类型定义
export interface User {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

// 认证上下文类型定义
interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  authReady: boolean;
  setIsAuthenticated: (value: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  getAllUsers: () => Promise<User[]>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  authReady: false,
  setIsAuthenticated: () => {},
  setCurrentUser: () => {},
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  getAllUsers: async () => []
});