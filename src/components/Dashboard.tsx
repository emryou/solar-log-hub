import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Anlık Işınım</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">850.5 W/m²</div>
          <p className="text-sm text-muted-foreground mt-2">ESP32-SOLAR-001</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sıcaklık 1</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">45.2°C</div>
          <p className="text-sm text-muted-foreground mt-2">Sensör Sıcaklığı</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sıcaklık 2</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">43.8°C</div>
          <p className="text-sm text-muted-foreground mt-2">Panel Sıcaklığı</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Grafik Görünümü</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">API bağlantısı kurulduğunda gerçek zamanlı veriler gösterilecek.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
