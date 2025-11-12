import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'user' | 'viewer';
  organization_id: number;
  organization_name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
  contact_email?: string;
  contact_phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      apiClient.setToken(token);
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { user, token } = await apiClient.login(email, password);
      apiClient.setToken(token);
      setUser(user);
      
      toast({
        title: 'Giriş başarılı',
        description: `Hoş geldiniz, ${user.full_name}!`,
      });
    } catch (error: any) {
      toast({
        title: 'Giriş başarısız',
        description: error.message || 'Email veya şifre hatalı',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const { user, token } = await apiClient.register(data);
      apiClient.setToken(token);
      setUser(user);
      
      toast({
        title: 'Kayıt başarılı',
        description: 'Hesabınız oluşturuldu!',
      });
    } catch (error: any) {
      toast({
        title: 'Kayıt başarısız',
        description: error.message || 'Kayıt işlemi başarısız oldu',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const logout = () => {
    apiClient.setToken(null);
    setUser(null);
    
    toast({
      title: 'Çıkış yapıldı',
      description: 'Başarıyla çıkış yaptınız',
    });
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
