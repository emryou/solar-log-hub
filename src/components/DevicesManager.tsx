import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DevicesManager = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ESP32 Cihazları</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button className="w-full">Yeni Cihaz Ekle</Button>
          <p className="text-sm text-muted-foreground">
            API bağlantısı kurulunca ESP32 cihazlarınız otomatik olarak listelenecek.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DevicesManager;
