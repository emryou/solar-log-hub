import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Settings = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sistem Ayarları</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Veri kayıt aralığı ve diğer ayarlar burada yapılacak.</p>
      </CardContent>
    </Card>
  );
};

export default Settings;
