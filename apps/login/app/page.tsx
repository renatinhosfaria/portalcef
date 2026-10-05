"use client";

import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { useState } from "react";

import {
  LOGIN_ENDPOINT,
  LoginFlowError,
  analisarRespostaLogin,
  destinoAposLogin,
  prepararDadosLogin,
} from "./login-flow";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dadosLogin = prepararDadosLogin(email, password);

    if (!dadosLogin.email || !dadosLogin.password) {
      setError("Informe seu e-mail e sua senha.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosLogin),
        credentials: "include",
      });

      await analisarRespostaLogin(response);
      window.location.assign(
        destinoAposLogin(window.location.search, window.location.origin),
      );
    } catch (erro) {
      setError(
        erro instanceof LoginFlowError
          ? erro.message
          : "Não foi possível conectar ao servidor. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Column: Visual & Branding */}
      <div className="relative hidden h-full flex-col p-10 text-white lg:flex overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
          style={{ backgroundImage: "url('/login/login-bg.jpg')" }}
        />

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#785c18]/90 via-[#3a2c0a]/80 to-black/90 z-10" />

        <div className="relative z-20 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <GraduationCap
              aria-hidden="true"
              className="h-6 w-6 text-[#A3D154]"
            />
          </div>
          <span className="text-sm font-bold tracking-widest uppercase text-white/90">
            Colégio Essência Feliz
          </span>
        </div>

        <div className="relative z-20 mt-auto mb-32 max-w-lg">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight mb-6">
            Construindo <span className="text-[#A3D154]">sonhos</span>,<br />
            educando para a <span className="text-white">vida</span>.
          </h1>
          <p className="text-lg text-white/80 leading-relaxed mb-12">
            Bem-vindo ao nosso portal administrativo. Aqui gerenciamos o futuro
            dos nossos alunos com dedicação e excelência.
          </p>

          <div className="flex items-center gap-4 pt-8 border-t border-white/10">
            <div className="flex -space-x-3">
              <div className="h-10 w-10 rounded-full bg-[#FB923C] flex items-center justify-center text-xs font-bold text-white border-2 border-[#3a2c0a]">
                D
              </div>
              <div className="h-10 w-10 rounded-full bg-[#A3D154] flex items-center justify-center text-xs font-bold text-white border-2 border-[#3a2c0a]">
                A
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-500 flex items-center justify-center text-xs font-bold text-white border-2 border-[#3a2c0a]">
                P
              </div>
            </div>
            <span className="text-sm font-medium text-white/60">
              Acesso restrito para equipe.
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[400px]">
          <div className="flex flex-col space-y-2">
            <h1
              id="titulo-login"
              className="text-3xl font-bold tracking-tight text-slate-900"
            >
              Olá, bem-vindo de volta!
            </h1>
            <p className="text-slate-500">
              Insira suas credenciais para acessar sua conta.
            </p>
          </div>

          <form
            className="grid gap-6"
            onSubmit={handleSubmit}
            aria-labelledby="titulo-login"
            aria-busy={isLoading}
          >
            {error && (
              <div
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email" className="font-semibold text-slate-700">
                E-mail
              </Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="absolute left-3 top-3 h-5 w-5 text-slate-400"
                />
                <Input
                  id="email"
                  name="email"
                  placeholder="nome@escola.com.br"
                  type="email"
                  required
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-[#A3D154] focus:ring-[#A3D154]"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="password"
                className="font-semibold text-slate-700"
              >
                Senha
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="absolute left-3 top-3 h-5 w-5 text-slate-400"
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 pr-10 h-12 bg-slate-50 border-slate-200 focus:border-[#A3D154] focus:ring-[#A3D154]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Eye aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <a
                href="mailto:contato@portalcef.com.br?subject=Recuperação%20de%20acesso"
                className="text-sm font-semibold text-[#FB923C] hover:text-[#e07b28] hover:underline"
              >
                Esqueceu sua senha?
              </a>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold text-base shadow-sm mt-2 transition-all hover:translate-y-[-1px] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 h-5 w-5 animate-spin"
                  />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no Portal
                  <ArrowRight aria-hidden="true" className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500 mt-6">
            Não tem acesso?{" "}
            <a
              href="mailto:contato@portalcef.com.br?subject=Acesso%20ao%20portal"
              className="font-semibold text-[#A3D154] hover:underline"
            >
              Contate a secretaria
            </a>
          </div>

          <div className="pt-10 mt-auto text-center">
            <p className="text-xs text-slate-400 font-medium">
              © {new Date().getFullYear()} Colégio Essência Feliz. Portal
              Administrativo v2.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
