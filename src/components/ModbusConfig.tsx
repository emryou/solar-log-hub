import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ModbusConfig = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modbus Kayıt Haritası</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Sensör Modbus yapılandırması burada yönetilecek.</p>
      </CardContent>
    </Card>
  );
};

export default ModbusConfig;
