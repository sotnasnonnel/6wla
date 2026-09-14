"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criaWorkspace } from "@/server/workspaces/actions";
import {
  Alerta,
  Botao,
  Campo,
  CampoRotulado,
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
}: {
  workspaces: WorkspaceResumo[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--tinta-forte)]">
            Workspaces
          </h1>
          <p className="mt-0.5 text-sm text-[var(--tinta-fraca)]">
            Cada workspace é uma empresa isolada: quem está nele vê só as obras
            e as pessoas dele.
          </p>
        </div>
        <Botao onClick={() => setAberto(true)}>Criar workspace</Botao>
      </div>

      {workspaces.length === 0 ? (
        <Vazio
          titulo="Nenhum workspace"
          descricao="Crie o primeiro workspace e nomeie quem vai administrá-lo."
          acao={<Botao onClick={() => setAberto(true)}>Criar workspace</Botao>}
        />
      ) : (
        <ul className="divide-y divide-[#eceae7] overflow-hidden rounded-md border border-[var(--borda)] bg-white">
          {workspaces.map((w) => (
            <li
              key={w.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1"
            >
              <span className="font-mono text-xs font-semibold text-[var(--marca-azul)] sm:w-16 sm:shrink-0">
                {w.codigo}
              </span>
              <span className="min-w-0 flex-1 text-sm text-[var(--tinta-forte)] sm:truncate">
                {w.nome}
              </span>
              <span className="flex items-center gap-3 text-sm sm:contents">
              {!w.ativo ? (
                <span className="text-xs text-[var(--tinta-fraca)]">
                  inativo
                </span>
              ) : null}
              <span className="text-sm tabular-nums text-[var(--tinta-fraca)]">
                {plural(w.total_obras, "obra", "obras")}
              </span>
              <span className="text-sm tabular-nums text-[var(--tinta-fraca)] sm:w-24 sm:text-right">
                {plural(w.total_membros, "pessoa", "pessoas")}
              </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ModalCriarWorkspace aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
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

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Criar workspace"
      descricao="Um workspace agrupa as obras e as pessoas de uma empresa. Nada atravessa de um para outro."
      largura={520}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={pendente}>
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
            autoFocus
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
        <CampoRotulado
          id="adminEmail"
          rotulo="Administrador"
          dica="opcional, precisa já ter conta"
          
        >
          <Campo
            id="adminEmail"
            name="adminEmail"
            type="email"
            placeholder="pessoa@empresa.com"
          />
        </CampoRotulado>
        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}
