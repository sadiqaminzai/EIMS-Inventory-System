import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../../store';
import { authApi } from '../../api/auth';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { User as UserIcon, Building2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { updateCurrentUser } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });

      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('tenant_id', String((response.user as any).tenant_id ?? '1'));

      const nextUser = {
        id: String(response.user.id),
        name: response.user.name,
        email: response.user.email,
        role: (response.user as any).role ?? '',
        tenant_id: String((response.user as any).tenant_id ?? '1'),
        status: 'active',
        must_change_password: (response.user as any).must_change_password ?? false,
      };

      localStorage.setItem('current_user', JSON.stringify(nextUser));
      updateCurrentUser(nextUser);

      toast.success(`Welcome back, ${response.user.name}!`);
      navigate('/dashboard');
    } catch (error: any) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('current_user');
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.message;
      if (status === 401) {
        toast.error('Invalid email or password.');
      } else {
        toast.error(backendMessage || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 relative overflow-hidden">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1684393637060-70e50f950aba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920" 
          alt="Background" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-gray-900/90 to-blue-900/20" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md z-10 px-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="p-8 text-center border-b border-white/5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg mb-6 transform rotate-3">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Enterprise ERP</h1>
            <p className="text-gray-400 text-sm">Sign in to your corporate account</p>
          </div>

          {/* Login Form */}
          <div className="p-8 space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs uppercase tracking-wider">Email Address</Label>
                <div className="relative group">
                  <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="name@company.com"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs uppercase tracking-wider">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            
            <div className="text-center">
              <a href="#" className="text-sm text-blue-400 hover:text-blue-300">Forgot password?</a>
            </div>

          </div>
          
          {/* Footer */}
          <div className="px-8 py-4 bg-black/20 text-center">
            <p className="text-xs text-gray-500">
              © 2024 Enterprise ERP. Secured by 256-bit encryption.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
