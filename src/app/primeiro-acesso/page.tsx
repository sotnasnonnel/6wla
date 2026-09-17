import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { precisaTrocarSenha } from "@/server/admin/troca-senha";
import { FormSenha } from "@/app/(app)/conta/form-senha";
import { sair } from "@/app/login/actions";

export const metadata = { title: "Crie sua senha · Restrições 6WLA" };

/**
 * Fica fora do grupo (app) de propósito: o layout de lá manda quem precisa
 * trocar a senha para cá, e daqui não pode voltar para lá antes da troca.
 */
export default async function PaginaPrimeiroAcesso() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!precisaTrocarSenha(user)) redirect("/obras");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--marca-gelo)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--borda)] bg-white p-7 shadow-[var(--sombra-md)]">
        <h1 className="text-xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)]">
          Crie sua senha
        </h1>
        <p className="mb-5 text-sm text-[var(--tinta-fraca)]">
          Sua conta foi criada com uma senha provisória. Escolha uma senha só
          sua para continuar.
        </p>
        <FormSenha />
        {/* Aparelho compartilhado ou link aberto na conta errada: sair sem
            precisar trocar a senha de outra pessoa. */}
        <form
          action={sair}
          className="mt-5 border-t border-[var(--grade)] pt-4 text-sm text-[var(--tinta-fraca)]"
        >
          Não é {user.email ?? "você"}?{" "}
          <button
            type="submit"
            className="inline-flex min-h-10 items-center font-semibold text-[var(--marca-terracotta-escuro)] underline-offset-2 hover:underline"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
