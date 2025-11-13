import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ModbusConfig = () => {
  return (
    <Card>
      <CardHeader><CardTitle>Modbus Yapılandırması</CardTitle></CardHeader>
      <CardContent><p>Sensör seçtiğinizde Modbus ayarları burada yapılacak</p></CardContent>
    </Card>
  );
};

export default ModbusConfig;
