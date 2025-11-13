import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, Device, Sensor, ModbusMap } from '@/lib/api';
import { z } from 'zod';

const mapSchema = z.object({
  modbus_address: z.coerce.number().int().min(0, 'Adres 0 veya daha büyük olmalı'),
  register_type: z.enum(['holding', 'input', 'coil', 'discrete'], {
    errorMap: () => ({ message: 'Geçersiz register tipi' }),
  }),
  data_type: z.enum(['int16', 'uint16', 'int32', 'uint32', 'float32'], {
    errorMap: () => ({ message: 'Geçersiz veri tipi' }),
  }),
  scale_factor: z.coerce.number().default(1),
  offset: z.coerce.number().default(0),
});

const ModbusConfig = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null);
  const [maps, setMaps] = useState<ModbusMap[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const devs = await apiClient.getDevices();
        setDevices(devs);
        if (devs.length) setSelectedDeviceId(devs[0].id);
      } catch (e) {
        toast.error('Cihazlar yüklenemedi');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) return;
    (async () => {
      try {
        const sns = await apiClient.getSensorsByDevice(selectedDeviceId);
        setSensors(sns);
        setSelectedSensorId(sns[0]?.id ?? null);
      } catch (e) {
        toast.error('Sensörler yüklenemedi');
      }
    })();
  }, [selectedDeviceId]);

  const filteredMaps = useMemo(() => maps.filter(m => m.sensor_id === selectedSensorId), [maps, selectedSensorId]);

  useEffect(() => {
    (async () => {
      try {
        const all = await apiClient.getModbusMaps();
        setMaps(all);
      } catch (e) {
        // Sessizce geç, sayfa yine de çalışsın
      }
    })();
  }, [selectedSensorId]);

  const handleAddMap = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSensorId) {
      toast.error('Önce sensör seçin');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const payload = {
      modbus_address: fd.get('modbus_address'),
      register_type: String(fd.get('register_type') || ''),
      data_type: String(fd.get('data_type') || ''),
      scale_factor: fd.get('scale_factor') ?? '1',
      offset: fd.get('offset') ?? '0',
    };

    const parsed = mapSchema.safeParse(payload as any);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Geçersiz giriş');
      return;
    }

    try {
      setIsLoading(true);
      const created = await apiClient.createModbusMap(selectedSensorId, parsed.data as any);
      setMaps(prev => [...prev, created]);
      toast.success('Modbus adresi eklendi');
      setIsDialogOpen(false);
      (e.currentTarget as HTMLFormElement).reset();
    } catch (e) {
      toast.error('Ekleme başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMap = async (id: number) => {
    try {
      await apiClient.deleteModbusMap(id);
      setMaps(prev => prev.filter(m => m.id !== id));
      toast.success('Silindi');
    } catch (e) {
      toast.error('Silme başarısız');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modbus Yapılandırması</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Cihaz</Label>
            <Select
              value={selectedDeviceId ? String(selectedDeviceId) : undefined}
              onValueChange={(v) => setSelectedDeviceId(Number(v))}
            >
              <SelectTrigger><SelectValue placeholder="Cihaz seçin" /></SelectTrigger>
              <SelectContent>
                {devices.map(d => (
                  <SelectItem value={String(d.id)} key={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sensör</Label>
            <Select
              value={selectedSensorId ? String(selectedSensorId) : undefined}
              onValueChange={(v) => setSelectedSensorId(Number(v))}
              disabled={!sensors.length}
            >
              <SelectTrigger><SelectValue placeholder="Sensör seçin" /></SelectTrigger>
              <SelectContent>
                {sensors.map(s => (
                  <SelectItem value={String(s.id)} key={s.id}>{s.sensor_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Adresler</h3>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!selectedSensorId}><Plus className="h-4 w-4 mr-2" />Adres Ekle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Modbus Adresi</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddMap} className="grid gap-3">
                <div>
                  <Label>Register Tipi</Label>
                  <Select name="register_type">
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="holding">Holding</SelectItem>
                      <SelectItem value="input">Input</SelectItem>
                      <SelectItem value="coil">Coil</SelectItem>
                      <SelectItem value="discrete">Discrete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Veri Tipi</Label>
                  <Select name="data_type">
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="int16">int16</SelectItem>
                      <SelectItem value="uint16">uint16</SelectItem>
                      <SelectItem value="int32">int32</SelectItem>
                      <SelectItem value="uint32">uint32</SelectItem>
                      <SelectItem value="float32">float32</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modbus Adresi</Label>
                  <Input name="modbus_address" type="number" min={0} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Scale</Label>
                    <Input name="scale_factor" type="number" step="any" defaultValue={1} />
                  </div>
                  <div>
                    <Label>Offset</Label>
                    <Input name="offset" type="number" step="any" defaultValue={0} />
                  </div>
                </div>
                <Button type="submit" disabled={isLoading}>Kaydet</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {selectedSensorId ? (
            filteredMaps.length ? (
              filteredMaps.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded border p-3">
                  <div className="text-sm">
                    <div className="font-medium">{m.register_type} • {m.data_type} @ {m.modbus_address}</div>
                    <div className="text-muted-foreground text-xs">scale: {m.scale_factor} • offset: {m.offset}</div>
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteMap(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Bu sensör için adres tanımlı değil.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Önce sensör seçin.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ModbusConfig;

