import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await login(email, password);
      navigate('/');
    } catch (error) {
      // Error handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      full_name: formData.get('full_name') as string,
      organization_name: formData.get('organization_name') as string,
      contact_email: formData.get('contact_email') as string || undefined,
      contact_phone: formData.get('contact_phone') as string || undefined,
    };

    try {
      await register(data);
      navigate('/');
    } catch (error) {
      // Error handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">☀️ Solar İzleme</CardTitle>
          <CardDescription>Raspberry Pi Tabanlı Sensör Yönetim Sistemi</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Giriş Yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="ornek@sirket.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Şifre</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-full-name">Ad Soyad</Label>
                  <Input
                    id="register-full-name"
                    name="full_name"
                    type="text"
                    placeholder="Ahmet Yılmaz"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="register-org-name">Şirket Adı</Label>
                  <Input
                    id="register-org-name"
                    name="organization_name"
                    type="text"
                    placeholder="ABC Enerji Ltd."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    placeholder="ornek@sirket.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="register-password">Şifre</Label>
                  <Input
                    id="register-password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 karakter, harf ve rakam"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="register-phone">Telefon (opsiyonel)</Label>
                  <Input
                    id="register-phone"
                    name="contact_phone"
                    type="tel"
                    placeholder="+90 555 123 4567"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
