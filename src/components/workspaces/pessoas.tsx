"use client";

import { useState, useTransition } from "react";
import {
  adicionaPorEmail,
  alteraPapel,
  removeMembro,
} from "@/server/workspaces/actions";
import { criaUsuario, redefineSenha } from "@/server/admin/usuarios";
import type { MembroWorkspace } from "@/server/workspaces/queries";
import {
  Alerta,
  Botao,
  Campo,
  CampoRotulado,
  Selecao,
  Vazio,
} from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";

const PAPEIS = [
  { valor: "admin", rotulo: "Admin", explica: "gerencia pessoas e obras" },
  {
    valor: "gestor",
    rotulo: "Gestor",
    explica: "importa planilha e trava a linha de base",
  },
  { valor: "membro", rotulo: "Membro", explica: "edita restrições e comenta" },
] as const;

type Props = {
  workspaceId: string;
  workspaceNome: string;
  membros: MembroWorkspace[];
  meuId: string;
  souAdminGlobal: boolean;
};

/**
 * Pessoas do workspace. Duas formas de incluir alguém, porque são situações
 * diferentes: criar uma conta nova, ou trazer quem já usa o sistema em outro
 * workspace (o caso do consultor que atende vários clientes).
 */
export function PessoasWorkspace({
  workspaceId,
  workspaceNome,
  membros,
  meuId,
  souAdminGlobal,
}: Props) {
  const [modal, setModal] = useState<"nova" | "existente" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  const roda = (
    fn: () => Promise<{ ok: boolean; erro?: string }>,
    msg: string,
  ) =>
    inicia(async () => {
      const r = await fn();
      if (r.ok) {
        setErro(null);
        setOk(msg);
      } else {
        setOk(null);
        setErro(r.erro ?? "Não foi possível concluir.");
      }
    });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--tinta-forte)]">
            Pessoas
          </h1>
          <p className="mt-0.5 text-sm text-[var(--tinta-fraca)]">
            Quem trabalha em {workspaceNome} e o que cada um pode fazer.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Botao
            variante="secundario"
            className="flex-1 py-2 sm:flex-none sm:py-1.5"
            onClick={() => setModal("existente")}
          >
            Incluir quem já tem conta
          </Botao>
          <Botao
            className="flex-1 py-2 sm:flex-none sm:py-1.5"
            onClick={() => setModal("nova")}
          >
            Cadastrar pessoa
          </Botao>
        </div>
      </div>

      {erro ? (
        <div className="mb-3">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}
      {ok ? (
        <div className="mb-3">
          <Alerta tipo="ok">{ok}</Alerta>
        </div>
      ) : null}

      {membros.length === 0 ? (
        <Vazio
          titulo="Ninguém neste workspace ainda"
          descricao="Cadastre a primeira pessoa para que ela possa acompanhar as obras."
          acao={
            <Botao onClick={() => setModal("nova")}>Cadastrar pessoa</Botao>
          }
        />
      ) : (
        <ul className="divide-y divide-[#eceae7] overflow-hidden rounded-md border border-[var(--borda)] bg-white">
          {membros.map((m) => {
            const euMesmo = m.id === meuId && !souAdminGlobal;
            return (
              <li
                key={m.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2 sm:py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={
                      m.ativo
                        ? "text-sm text-[var(--tinta-forte)]"
                        : "text-sm text-[var(--tinta-fraca)] line-through"
                    }
                  >
                    {m.nome}
                    {m.id === meuId ? (
                      <span className="ml-1.5 text-xs text-[var(--tinta-fraca)]">
                        você
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--tinta-fraca)]">
                    {m.email}
                  </div>
                </div>

                {!m.ativo ? (
                  <span className="text-xs text-[var(--marca-terracotta-vermelho)]">
                    conta desativada
                  </span>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                <select
                  value={m.papel}
                  disabled={pendente || euMesmo}
                  aria-label={`Papel de ${m.nome}`}
                  onChange={(ev) => {
                    const f = new FormData();
                    f.set("workspaceId", workspaceId);
                    f.set("userId", m.id);
                    f.set("papel", ev.target.value);
                    roda(
                      () => alteraPapel(f),
                      `${m.nome} agora é ${ev.target.value}.`,
                    );
                  }}
                  className="rounded-md border border-[var(--borda)] bg-white px-2 py-1.5 text-xs text-[var(--tinta-media)] disabled:bg-[var(--marca-gelo)] sm:py-1"
                >
                  {PAPEIS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>

                <Botao
                  variante="fantasma"
                  disabled={pendente}
                  onClick={() => {
                    const senha = window.prompt(
                      `Nova senha para ${m.nome} (mínimo 8 caracteres):`,
                    );
                    if (!senha) return;
                    const f = new FormData();
                    f.set("workspaceId", workspaceId);
                    f.set("userId", m.id);
                    f.set("senha", senha);
                    roda(
                      () => redefineSenha(f),
                      `Senha de ${m.nome} redefinida.`,
                    );
                  }}
                >
                  Trocar senha
                </Botao>
                <Botao
                  variante="fantasma"
                  disabled={pendente || euMesmo}
                  onClick={() => {
                    if (
                      !window.confirm(`Remover ${m.nome} de ${workspaceNome}?`)
                    )
                      return;
                    const f = new FormData();
                    f.set("workspaceId", workspaceId);
                    f.set("userId", m.id);
                    roda(() => removeMembro(f), `${m.nome} saiu do workspace.`);
                  }}
                >
                  Remover
                </Botao>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-[var(--tinta-fraca)]">
        {PAPEIS.map((p) => `${p.rotulo} ${p.explica}`).join(". ")}.
      </p>

      <ModalPessoaNova
        aberto={modal === "nova"}
        aoFechar={() => setModal(null)}
        workspaceId={workspaceId}
        aoConcluir={(msg) => {
          setOk(msg);
          setErro(null);
        }}
      />
      <ModalPessoaExistente
        aberto={modal === "existente"}
        aoFechar={() => setModal(null)}
        workspaceId={workspaceId}
        aoConcluir={(msg) => {
          setOk(msg);
          setErro(null);
        }}
      />
    </>
  );
}

function SelecaoPapel({ id }: { id: string }) {
  return (
    <Selecao id={id} name="papel" defaultValue="membro">
      {PAPEIS.map((p) => (
        <option key={p.valor} value={p.valor}>
          {p.rotulo} — {p.explica}
        </option>
      ))}
    </Selecao>
  );
}

function ModalPessoaNova({
  aberto,
  aoFechar,
  workspaceId,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  workspaceId: string;
  aoConcluir: (msg: string) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Cadastrar pessoa"
      descricao="A conta é criada com uma senha inicial, que a pessoa troca depois em Sua conta."
      largura={560}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-pessoa-nova" disabled={pendente}>
            {pendente ? "Cadastrando…" : "Cadastrar pessoa"}
          </Botao>
        </>
      }
    >
      <form
        id="form-pessoa-nova"
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const form = ev.currentTarget;
          const dados = new FormData(form);
          dados.set("workspaceId", workspaceId);
          inicia(async () => {
            const r = await criaUsuario(dados);
            if (!r.ok) {
              setErro(r.erro);
              return;
            }
            setErro(null);
            form.reset();
            aoFechar();
            aoConcluir(
              r.dados.contaExistente
                ? "Essa pessoa já tinha conta em outro sistema da PHD: foi incluída no workspace e entra com a senha que já usa. A senha digitada foi ignorada."
                : "Pessoa cadastrada e incluída no workspace.",
            );
          });
        }}
      >
        <CampoRotulado id="p-nome" rotulo="Nome">
          <Campo id="p-nome" name="nome" required autoFocus maxLength={120} />
        </CampoRotulado>
        <CampoRotulado id="p-email" rotulo="E-mail">
          <Campo id="p-email" name="email" type="email" required />
        </CampoRotulado>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoRotulado
            id="p-senha"
            rotulo="Senha inicial"
            dica="mínimo 8 caracteres"
          >
            <Campo
              id="p-senha"
              name="senha"
              type="text"
              required
              minLength={8}
              autoComplete="off"
            />
          </CampoRotulado>
          <CampoRotulado id="p-papel" rotulo="Papel">
            <SelecaoPapel id="p-papel" />
          </CampoRotulado>
        </div>
        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}

function ModalPessoaExistente({
  aberto,
  aoFechar,
  workspaceId,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  workspaceId: string;
  aoConcluir: (msg: string) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Incluir quem já tem conta"
      descricao="Para quem já usa o sistema em outro workspace. A pessoa mantém a mesma senha."
      largura={520}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-pessoa-existente" disabled={pendente}>
            {pendente ? "Incluindo…" : "Incluir no workspace"}
          </Botao>
        </>
      }
    >
      <form
        id="form-pessoa-existente"
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const form = ev.currentTarget;
          const dados = new FormData(form);
          dados.set("workspaceId", workspaceId);
          inicia(async () => {
            const r = await adicionaPorEmail(dados);
            if (!r.ok) {
              setErro(r.erro);
              return;
            }
            setErro(null);
            form.reset();
            aoFechar();
            aoConcluir("Pessoa incluída no workspace.");
          });
        }}
      >
        <CampoRotulado id="e-email" rotulo="E-mail">
          <Campo id="e-email" name="email" type="email" required autoFocus />
        </CampoRotulado>
        <CampoRotulado id="e-papel" rotulo="Papel">
          <SelecaoPapel id="e-papel" />
        </CampoRotulado>
        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}
