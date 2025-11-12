import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Cpu, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';

export default function DevicesManager() {
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const data = await apiClient.getDevices();
      setDevices(data);
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Cihazlar yüklenemedi',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await apiClient.createDevice({
        name: formData.get('name') as string,
        ip_address: formData.get('ip_address') as string,
        description: formData.get('description') as string,
      });
      
      toast({
        title: 'Başarılı',
        description: 'Cihaz eklendi',
      });
      
      setIsDialogOpen(false);
      loadDevices();
    } catch (error: any) {
      toast({
        title: 'Hata',
        description: error.message || 'Cihaz eklenemedi',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDevice = async (id: number, name: string) => {
    if (!confirm(`${name} cihazını silmek istediğinizden emin misiniz?`)) {
      return;
    }
    
    try {
      await apiClient.deleteDevice(id);
      toast({
        title: 'Başarılı',
        description: 'Cihaz silindi',
      });
      loadDevices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Cihaz silinemedi',
        variant: 'destructive',
      });
    }
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 600000; // 10 dakika
  };

  if (isLoading) {
    return <div className="text-center py-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ESP32 Cihazları</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Cihaz Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni ESP32 Cihazı Ekle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDevice} className="space-y-4">
                <div>
                  <Label htmlFor="name">Cihaz Adı *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="ESP32-SOLAR-001"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ESP32 firmware'deki isimle aynı olmalı
                  </p>
                </div>
                <div>
                  <Label htmlFor="ip_address">IP Adresi</Label>
                  <Input
                    id="ip_address"
                    name="ip_address"
                    placeholder="192.168.1.50"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Açıklama</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Çatı sensör ünitesi"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Cihazı Ekle
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Henüz cihaz eklenmemiş</p>
              <p className="text-sm mt-2">Yukarıdaki butonu kullanarak ESP32 cihazı ekleyin</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => (
                <Card key={device.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{device.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOnline(device.last_seen) ? (
                          <span title="Online"><Wifi className="h-4 w-4 text-green-500" /></span>
                        ) : (
                          <span title="Offline"><WifiOff className="h-4 w-4 text-muted-foreground" /></span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {device.ip_address && (
                        <p>IP: {device.ip_address}</p>
                      )}
                      {device.description && (
                        <p>{device.description}</p>
                      )}
                      {device.last_seen && (
                        <p className="text-xs">
                          Son görülme: {new Date(device.last_seen).toLocaleString('tr-TR')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
