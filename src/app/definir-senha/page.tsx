import Image from "next/image";
import { FormDefinirSenha } from "./form-definir-senha";

export const metadata = { title: "Crie sua senha · Restrições 6WLA" };

/**
 * Destino do link do convite e do "esqueci minha senha". Fica fora do grupo
 * (app) e é pública no proxy: quem chega ainda não tem sessão — ela nasce
 * aqui, a partir do link, no navegador (o fragmento `#access_token` nunca
 * chega ao servidor).
 */
export default function PaginaDefinirSenha() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--marca-gelo)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--borda)] bg-white p-7 shadow-[var(--sombra-md)]">
        <Image
          src="/logo-phd.png"
          alt="PHD Engenharia"
          width={1586}
          height={226}
          priority
          className="mb-5 h-auto w-[168px]"
        />
        <h1 className="text-xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)]">
          Crie sua senha
        </h1>
        <p className="mb-5 text-sm text-[var(--tinta-fraca)]">
          6WLA · Last Planner System
        </p>
        <FormDefinirSenha />
      </div>
    </main>
  );
}
