import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Dashboard from '@/components/Dashboard';
import DevicesManager from '@/components/DevicesManager';
import ModbusConfig from '@/components/ModbusConfig';
import Settings from '@/components/Settings';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">☀️ Solar Radyasyon İzleme Sistemi</h1>
          <p className="text-sm opacity-90 mt-1">Raspberry Pi + ESP32 Tabanlı Sensör Yönetimi</p>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="devices">Cihazlar</TabsTrigger>
            <TabsTrigger value="modbus">Modbus Yapılandırma</TabsTrigger>
            <TabsTrigger value="settings">Ayarlar</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
