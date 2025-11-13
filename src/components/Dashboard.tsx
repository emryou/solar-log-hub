import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

const Dashboard = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [latestData, setLatestData] = useState<any>({});

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const devs = await apiClient.getDevices();
      setDevices(devs);
      
      for (const dev of devs) {
        const data = await apiClient.getLatestSensorData(dev.id);
        setLatestData(prev => ({ ...prev, [dev.id]: data }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {devices.map(device => (
        <Card key={device.id}>
          <CardHeader>
            <CardTitle>{device.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {latestData[device.id]?.map((sensor: any) => (
              <div key={sensor.id} className="mb-2">
                <div className="text-2xl font-bold">{sensor.value} {sensor.unit}</div>
                <p className="text-sm text-muted-foreground">{sensor.sensor_name}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Dashboard;
