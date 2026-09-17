import Link from "next/link";
import { exigeUsuario } from "@/server/auth";
import { Cartao, CabecalhoPagina } from "@/components/ui/basicos";
import { BotaoCopiar } from "@/components/ui/copiar";

/**
 * Sem workspace para entrar. Para o admin, é o sistema vazio: o próximo passo
 * é criar o primeiro. Para os demais, falta alguém dar acesso — o e-mail é o
 * que o administrador precisa para achar a conta.
 */
export default async function PaginaSemWorkspace() {
  const { perfil } = await exigeUsuario();

  if (perfil.admin) {
    return (
      <div className="max-w-lg">
        <CabecalhoPagina titulo={`Olá, ${perfil.nome}`} apoio={perfil.email} />
        <Cartao>
          <p className="text-sm text-[var(--tinta-media)]">
            Ainda não existe nenhum workspace. Cada workspace é uma empresa:
            crie o primeiro e depois cadastre o gestor dele em Usuários.
          </p>
          <Link
            href="/admin/workspaces?novo=1"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[var(--marca-terracotta)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--marca-terracotta-escuro)]"
          >
            Criar workspace
          </Link>
        </Cartao>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <CabecalhoPagina titulo={`Olá, ${perfil.nome}`} apoio={perfil.email} />
      <Cartao>
        <p className="text-sm text-[var(--tinta-media)]">
          Sua conta ainda não está em nenhum workspace. Envie seu e-mail a um
          administrador da PHD e peça para definir seu workspace e seu papel.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <BotaoCopiar texto={perfil.email} rotulo="Copiar meu e-mail" />
        </div>
      </Cartao>
    </div>
  );
}
