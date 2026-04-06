import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Eye, EyeOff, Lock, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../config/api';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

const loginSchema = z.object({
  login: z.string().min(1, 'Ingresa tu email o usuario'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPass, setShowPass] = React.useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const response = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = response.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success(`Bienvenido, ${user.username}!`);

      if (user.role === 'superadmin') {
        navigate('/sa/restaurantes');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <UtensilsCrossed size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Commy</h1>
            <p className="text-slate-500 text-sm mt-1">Panel de gestión de restaurantes</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Login field */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Email o usuario
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('login')}
                  type="text"
                  placeholder="tu@email.com o usuario"
                  autoComplete="username"
                  className={cn(
                    'w-full pl-10 pr-4 py-3 border rounded-xl text-sm transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'placeholder:text-slate-400 bg-slate-50',
                    errors.login ? 'border-red-300' : 'border-slate-200'
                  )}
                />
              </div>
              {errors.login && <p className="text-xs text-red-500">{errors.login.message}</p>}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn(
                    'w-full pl-10 pr-12 py-3 border rounded-xl text-sm transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'placeholder:text-slate-400 bg-slate-50',
                    errors.password ? 'border-red-300' : 'border-slate-200'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              className="w-full py-3 text-base rounded-xl"
            >
              Iniciar sesión
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} Commy. Sistema de gestión para restaurantes.
          </p>
        </div>
      </div>
    </div>
  );
};
