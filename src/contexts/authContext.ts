import { createContext } from "react";

// 用户类型定义
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt: string;
}

export type LoginResult = 'success' | 'invalid' | 'unconfirmed' | 'error';

// 认证上下文类型定义
interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  authReady: boolean;
  setIsAuthenticated: (value: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  getAllUsers: () => Promise<User[]>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  authReady: false,
  setIsAuthenticated: () => {},
  setCurrentUser: () => {},
  login: async () => 'error',
  register: async (_email: string, _password: string, _firstName: string, _lastName: string) => false,
  logout: async () => {},
  getAllUsers: async () => []
});