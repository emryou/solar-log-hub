import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';

const sensorSchema = z.object({
  sensor_name: z.string().trim().min(1, 'Sensör adı gerekli').max(100),
  sensor_type: z.string().trim().min(1, 'Sensör tipi gerekli').max(50),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
});

const DevicesManager = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [sensors, setSensors] = useState<any[]>([]);
  const [isDeviceOpen, setIsDeviceOpen] = useState(false);
  const [isSensorOpen, setIsSensorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) loadSensors(selectedDevice.id);
    else setSensors([]);
  }, [selectedDevice]);

  const loadDevices = async () => {
    try {
      const data = await apiClient.getDevices();
      setDevices(data);
      if (data.length && !selectedDevice) setSelectedDevice(data[0]);
    } catch (error) {
      toast.error('Cihazlar yüklenemedi');
    }
  };

  const loadSensors = async (deviceId: number) => {
    try {
      const data = await apiClient.getSensorsByDevice(deviceId);
      setSensors(data);
    } catch (error) {
      toast.error('Sensörler yüklenemedi');
    }
  };

  const handleAddDevice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      setIsLoading(true);
      await apiClient.createDevice({
        name: formData.get('name'),
        ip_address: formData.get('ip_address'),
        description: formData.get('description'),
      });
      toast.success('Cihaz eklendi');
      setIsDeviceOpen(false);
      e.currentTarget.reset();
      await loadDevices();
    } catch (error) {
      toast.error('Cihaz eklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSensor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    const payload = {
      sensor_name: String(formData.get('sensor_name') || ''),
      sensor_type: String(formData.get('sensor_type') || ''),
      unit: String(formData.get('unit') || ''),
      is_active: 1,
    } as any;

    const parsed = sensorSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Geçersiz giriş');
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.createSensor(selectedDevice.id, payload);
      toast.success('Sensör eklendi');
      setIsSensorOpen(false);
      (e.currentTarget as HTMLFormElement).reset();
      await loadSensors(selectedDevice.id);
    } catch (error) {
      toast.error('Sensör eklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSensor = async (sensorId: number) => {
    if (!selectedDevice) return;
    try {
      await apiClient.deleteSensor(sensorId);
      toast.success('Sensör silindi');
      await loadSensors(selectedDevice.id);
    } catch (error) {
      toast.error('Sensör silinemedi');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Cihazlar</CardTitle>
            <Dialog open={isDeviceOpen} onOpenChange={setIsDeviceOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Cihaz Ekle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Yeni Cihaz</DialogTitle></DialogHeader>
                <form onSubmit={handleAddDevice} className="space-y-4">
                  <div><Label>İsim</Label><Input name="name" required /></div>
                  <div><Label>IP</Label><Input name="ip_address" /></div>
                  <div><Label>Açıklama</Label><Input name="description" /></div>
                  <Button type="submit" disabled={isLoading}>Kaydet</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {devices.map(d => (
              <Card
                key={d.id}
                className={`cursor-pointer ${selectedDevice?.id === d.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedDevice(d)}
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold">{d.name}</h3>
                  <p className="text-sm text-muted-foreground">{d.ip_address || 'IP yok'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sensörler</CardTitle>
            <Dialog open={isSensorOpen} onOpenChange={setIsSensorOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!selectedDevice}><Plus className="h-4 w-4 mr-2" />Sensör Ekle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni Sensör {selectedDevice ? `• ${selectedDevice.name}` : ''}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSensor} className="space-y-4">
                  <div>
                    <Label>Sensör Adı</Label>
                    <Input name="sensor_name" required />
                  </div>
                  <div>
                    <Label>Tip</Label>
                    <Input name="sensor_type" required placeholder="ör. radiation, temperature" />
                  </div>
                  <div>
                    <Label>Birim</Label>
                    <Input name="unit" placeholder="ör. W/m², °C" />
                  </div>
                  <Separator />
                  <Button type="submit" disabled={isLoading}>Kaydet</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedDevice && <p>Önce bir cihaz seçin.</p>}
          {selectedDevice && (
            <div className="space-y-2">
              {sensors.length === 0 && (
                <p className="text-sm text-muted-foreground">Bu cihaza ait sensör yok. "Sensör Ekle" ile ekleyin.</p>
              )}
              {sensors.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <div className="font-medium">{s.sensor_name} {s.unit ? `(${s.unit})` : ''}</div>
                    <div className="text-xs text-muted-foreground">Tip: {s.sensor_type}</div>
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteSensor(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DevicesManager;

