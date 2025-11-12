import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, User } from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import DevicesManager from '@/components/DevicesManager';
import ModbusConfig from '@/components/ModbusConfig';
import Settings from '@/components/Settings';
import AdminPanel from '@/components/AdminPanel';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">☀️ Solar Radyasyon İzleme</h1>
            <p className="text-xs md:text-sm opacity-90 mt-1">
              {user?.organization_name} • {user?.full_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="hidden md:flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Admin</span>
              </div>
            )}
            {!isAdmin && (
              <div className="hidden md:flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">Kullanıcı</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="bg-white/10 hover:bg-white/20 border-white/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} mb-6`}>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="devices">Cihazlar</TabsTrigger>
            <TabsTrigger value="modbus">Modbus</TabsTrigger>
            <TabsTrigger value="settings">Ayarlar</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Admin Panel</TabsTrigger>}
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>

          <TabsContent value="devices">
            <DevicesManager />
          </TabsContent>

          <TabsContent value="modbus">
            <ModbusConfig />
          </TabsContent>

          <TabsContent value="settings">
            <Settings />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <AdminPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
