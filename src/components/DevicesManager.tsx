import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';

const DevicesManager = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [sensors, setSensors] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) loadSensors(selectedDevice.id);
  }, [selectedDevice]);

  const loadDevices = async () => {
    try {
      const data = await apiClient.getDevices();
      setDevices(data);
    } catch (error) {
      toast.error('Yükleme hatası');
    }
  };

  const loadSensors = async (deviceId: number) => {
    try {
      const data = await apiClient.getSensorsByDevice(deviceId);
      setSensors(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddDevice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await apiClient.createDevice({
        name: formData.get('name'),
        ip_address: formData.get('ip_address'),
        description: formData.get('description'),
      });
      toast.success('Cihaz eklendi');
      setIsOpen(false);
      loadDevices();
    } catch (error) {
      toast.error('Hata');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Cihazlar</CardTitle>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Ekle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Yeni Cihaz</DialogTitle></DialogHeader>
                <form onSubmit={handleAddDevice} className="space-y-4">
                  <div><Label>İsim</Label><Input name="name" required /></div>
                  <div><Label>IP</Label><Input name="ip_address" /></div>
                  <div><Label>Açıklama</Label><Input name="description" /></div>
                  <Button type="submit">Kaydet</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {devices.map(d => (
            <Card key={d.id} className="mb-2 cursor-pointer" onClick={() => setSelectedDevice(d)}>
              <CardContent className="p-4"><h3 className="font-semibold">{d.name}</h3></CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sensörler</CardTitle></CardHeader>
        <CardContent>
          {selectedDevice ? sensors.map(s => (
            <div key={s.id} className="mb-2 p-2 border rounded">{s.sensor_name}</div>
          )) : <p>Cihaz seçin</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default DevicesManager;
