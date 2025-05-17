import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import mysqlService, { User } from '../services/mysqlService';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Проверяем токен и получаем данные текущего пользователя
        const user = await mysqlService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        // Если ошибка аутентификации, очищаем данные пользователя
        setCurrentUser(null);
        mysqlService.clearToken();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    const user = await mysqlService.loginUser(email, password);
    setCurrentUser(user);
    return user;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const user = await mysqlService.registerUser(email, password, displayName);
    setCurrentUser(user);
    return user;
  };

  const signOut = async () => {
    mysqlService.clearToken();
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loading,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 