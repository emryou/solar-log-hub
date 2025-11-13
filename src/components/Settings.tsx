import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';

const Settings = () => {
  const [settings, setSettings] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiClient.getSettings();
      setSettings(data);
    } catch (error) {
      toast.error('Ayarlar yüklenemedi');
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    try {
      await apiClient.updateSetting(key, value);
      toast.success('Güncellendi');
    } catch (error) {
      toast.error('Hata');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Sistem Ayarları</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {settings.map(s => (
          <div key={s.key}>
            <label className="text-sm font-medium">{s.description || s.key}</label>
            <div className="flex gap-2">
              <Input defaultValue={s.value} id={s.key} />
              <Button onClick={() => {
                const val = (document.getElementById(s.key) as HTMLInputElement).value;
                handleUpdate(s.key, val);
              }}>Kaydet</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Settings;
