"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  criaWorkspace,
  selecionaWorkspace,
} from "@/server/workspaces/actions";
import {
  Alerta,
  Botao,
  Campo,
  CampoRotulado,
  Etiqueta,
  Vazio,
} from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";

export type WorkspaceResumo = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  total_membros: number;
  total_obras: number;
};

function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function ListaWorkspaces({
  workspaces,
  atualId,
  abrirCriacao = false,
}: {
  workspaces: WorkspaceResumo[];
  /** Workspace em que o admin está agora (cookie), para marcar na lista. */
  atualId: string | null;
  /** `?novo=1`: chega com o cadastro aberto (vindo de um estado vazio). */
  abrirCriacao?: boolean;
}) {
  const [aberto, setAberto] = useState(abrirCriacao);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-7">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)]">
            Workspaces
          </h1>
          <p className="mt-0.5 text-sm text-[var(--tinta-fraca)]">
            Cada workspace é uma empresa. Cada pessoa pertence a um só, e vê
            apenas as obras em que foi incluída.
          </p>
        </div>
        <Botao onClick={() => setAberto(true)}>Criar workspace</Botao>
      </div>

      {workspaces.length === 0 ? (
        <Vazio
          titulo="Nenhum workspace"
          descricao="Crie o primeiro workspace. Depois cadastre o gestor dele em Usuários."
          acao={<Botao onClick={() => setAberto(true)}>Criar workspace</Botao>}
        />
      ) : (
        <ul className="divide-y divide-[var(--grade)] overflow-hidden rounded-xl border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)]">
          {workspaces.map((w) => (
            <li
              key={w.id}
              // A linha inteira leva às pessoas do workspace (link esticado);
              // "Entrar" fica por cima, clicável à parte.
              className="relative flex flex-col gap-2 px-4 py-3 transition hover:bg-[var(--plano)] sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--marca-azul)]">
                    {w.codigo}
                  </span>
                  <Link
                    href={`/admin/usuarios?workspace=${w.id}`}
                    className="min-w-0 truncate text-sm font-medium text-[var(--tinta-forte)] after:absolute after:inset-0 hover:text-[var(--marca-terracotta)]"
                  >
                    {w.nome}
                  </Link>
                  {!w.ativo ? <Etiqueta>Inativo</Etiqueta> : null}
                  {w.id === atualId ? (
                    <Etiqueta tom="azul">Você está aqui</Etiqueta>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs tabular-nums text-[var(--tinta-fraca)]">
                  {plural(w.total_obras, "obra", "obras")} ·{" "}
                  {plural(w.total_membros, "pessoa", "pessoas")}
                </div>
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-1">
                <Link
                  href={`/admin/usuarios?workspace=${w.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[var(--tinta-media)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--tinta-forte)] sm:min-h-9"
                >
                  Ver pessoas
                </Link>
                {w.id !== atualId ? (
                  <form action={selecionaWorkspace}>
                    <input type="hidden" name="workspaceId" value={w.id} />
                    <BotaoEntrar />
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ModalCriarWorkspace aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante="secundario" disabled={pending}>
      {pending ? "Entrando…" : "Entrar neste workspace"}
    </Botao>
  );
}

function ModalCriarWorkspace({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();
  const fecha = () => {
    if (pendente) return;
    setErro(null);
    aoFechar();
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={fecha}
      titulo="Criar workspace"
      descricao="Um workspace agrupa as obras e as pessoas de uma empresa. Nada atravessa de um para outro."
      largura={520}
      rodape={
        <>
          <Botao variante="secundario" onClick={fecha} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-criar-workspace" disabled={pendente}>
            {pendente ? "Criando…" : "Criar workspace"}
          </Botao>
        </>
      }
    >
      <form
        id="form-criar-workspace"
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const form = ev.currentTarget;
          inicia(async () => {
            const r = await criaWorkspace(new FormData(form));
            if (!r.ok) {
              setErro(r.erro);
              return;
            }
            setErro(null);
            form.reset();
            aoFechar();
            router.refresh();
          });
        }}
      >
        <CampoRotulado id="codigo" rotulo="Código">
          <Campo
            id="codigo"
            name="codigo"
            required
            data-autofocus
            maxLength={30}
            placeholder="PHD"
          />
        </CampoRotulado>
        <CampoRotulado id="nome" rotulo="Nome">
          <Campo
            id="nome"
            name="nome"
            required
            maxLength={120}
            placeholder="PHD Engenharia"
          />
        </CampoRotulado>
        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}
