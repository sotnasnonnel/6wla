"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  alternaAtivo,
  criaUsuario,
  defineAcesso,
  enviaLinkSenha,
  reenviaConvite,
} from "@/server/admin/usuarios";
import {
  Alerta,
  Botao,
  CabecalhoPagina,
  Campo,
  CampoRotulado,
  Etiqueta,
  Selecao,
  Vazio,
} from "@/components/ui/basicos";
import { filtraPorTermo } from "@/components/ui/busca";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Modal } from "@/components/ui/modal";

type Papel = "admin" | "gestor" | "membro";
type PapelWs = Exclude<Papel, "admin">;

type Usuario = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  /** `null`: perfil sem vínculo (ainda não pode entrar em obra nenhuma). */
  papel: Papel | null;
  workspaceId: string | null;
  /** Nunca entrou (convite ainda não usado). Calculado no servidor. */
  convitePendente: boolean;
};

type Workspace = { id: string; codigo: string; nome: string };

type Resposta = { ok: true } | { ok: false; erro: string };

const PAPEIS: ReadonlyArray<{ valor: Papel; rotulo: string; explica: string }> =
  [
    {
      valor: "gestor",
      rotulo: "Gestor",
      explica: "cria obras e monta a equipe de cada uma",
    },
    {
      valor: "membro",
      rotulo: "Membro",
      explica: "trabalha nas obras em que foi incluído",
    },
    {
      valor: "admin",
      rotulo: "Admin",
      explica: "vê todas as obras e administra o sistema",
    },
  ];

const ehPapel = (v: string): v is Papel =>
  v === "admin" || v === "gestor" || v === "membro";

/** Tempo que o aviso de sucesso fica junto da linha. Erro fica até a próxima ação. */
const DURACAO_AVISO_MS = 4000;

/**
 * Todas as contas do 6wla. Cada pessoa tem um papel e, se não for admin, um
 * workspace; os dois se mudam direto na linha. Mudanças que alteram o que a
 * pessoa enxerga passam por um diálogo que diz o efeito antes.
 */
export function AdminUsuarios({
  usuarios,
  workspaces,
  meuId,
  filtroWorkspace,
}: {
  usuarios: Usuario[];
  workspaces: Workspace[];
  meuId: string;
  /** Vindo de "Ver pessoas" em Workspaces. */
  filtroWorkspace: Workspace | null;
}) {
  const [novo, setNovo] = useState(false);
  const [termo, setTermo] = useState("");

  const doWorkspace = filtroWorkspace
    ? usuarios.filter((u) => u.workspaceId === filtroWorkspace.id)
    : usuarios;
  const visiveis = filtraPorTermo(doWorkspace, termo, (u) => [u.nome, u.email]);
  const buscando = termo.trim() !== "";

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        apoio="Quem usa o 6wla, em qual workspace e com qual papel."
        acoes={
          <Botao
            onClick={() => setNovo(true)}
            disabled={workspaces.length === 0}
          >
            Cadastrar usuário
          </Botao>
        }
      />

      {workspaces.length === 0 ? (
        <div className="mb-3">
          <Alerta tipo="info">
            Crie um workspace antes de cadastrar gestores e membros.{" "}
            <Link
              href="/admin/workspaces?novo=1"
              className="font-semibold underline"
            >
              Criar workspace
            </Link>
          </Alerta>
        </div>
      ) : null}

      {filtroWorkspace ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--tinta-media)]">
          <span>
            Mostrando só <strong>{filtroWorkspace.nome}</strong> (
            {doWorkspace.length}{" "}
            {doWorkspace.length === 1 ? "pessoa" : "pessoas"})
          </span>
          <Link
            href="/admin/usuarios"
            className="inline-flex min-h-10 items-center rounded-lg px-2 font-semibold text-[var(--marca-terracotta)] hover:underline"
          >
            Ver todos
          </Link>
        </div>
      ) : null}

      {doWorkspace.length > 6 ? (
        <div className="mb-3 max-w-sm">
          <Campo
            type="search"
            value={termo}
            onChange={(ev) => setTermo(ev.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar usuário"
          />
        </div>
      ) : null}

      {visiveis.length === 0 ? (
        <Vazio
          titulo={
            buscando
              ? "Ninguém com esse nome ou e-mail"
              : filtroWorkspace
                ? "Ninguém neste workspace ainda"
                : "Nenhum usuário"
          }
          descricao={
            buscando
              ? "Confira a grafia ou limpe a busca."
              : "Cadastre o primeiro gestor para ele criar as obras."
          }
          {...(!buscando && workspaces.length > 0
            ? {
                acao: (
                  <Botao onClick={() => setNovo(true)}>Cadastrar usuário</Botao>
                ),
              }
            : {})}
        />
      ) : (
        <ul className="divide-y divide-[var(--grade)] overflow-hidden rounded-xl border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)]">
          {visiveis.map((u) => (
            <LinhaUsuario
              key={u.id}
              u={u}
              eu={u.id === meuId}
              workspaces={workspaces}
            />
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-[var(--tinta-fraca)]">
        {PAPEIS.map((p) => `${p.rotulo} ${p.explica}`).join(". ")}.
      </p>

      <ModalUsuarioNovo
        aberto={novo}
        aoFechar={() => setNovo(false)}
        workspaces={workspaces}
        workspaceInicial={filtroWorkspace?.id ?? ""}
      />
    </>
  );
}

type Dialogo =
  | { tipo: "promove" }
  | { tipo: "desativa" }
  | { tipo: "senha" }
  | { tipo: "troca-ws"; workspaceId: string }
  /** Sair de admin, ou ganhar o primeiro vínculo: papel e workspace juntos. */
  | { tipo: "vincula"; papel: PapelWs; workspaceId: string };

/**
 * Uma pessoa. Espera, aviso e diálogos são desta linha: mexer em alguém não
 * trava a lista inteira nem joga a mensagem longe de quem foi alterado.
 */
function LinhaUsuario({
  u,
  eu,
  workspaces,
}: {
  u: Usuario;
  eu: boolean;
  workspaces: Workspace[];
}) {
  const [pendente, inicia] = useTransition();
  const [aviso, setAviso] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [erroDialogo, setErroDialogo] = useState<string | null>(null);

  useEffect(() => {
    if (aviso?.tipo !== "ok") return;
    const t = window.setTimeout(() => setAviso(null), DURACAO_AVISO_MS);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const nomeWs = (id: string | null) =>
    workspaces.find((w) => w.id === id)?.nome ?? "outro workspace";

  const abre = (d: Dialogo) => {
    setErroDialogo(null);
    setDialogo(d);
  };
  const fecha = () => {
    setErroDialogo(null);
    setDialogo(null);
  };

  /** Roda a action; com diálogo aberto, o erro aparece nele. */
  const executa = (fn: () => Promise<Resposta>, msg: string) =>
    inicia(async () => {
      const r = await fn();
      if (r.ok) {
        setDialogo(null);
        setErroDialogo(null);
        setAviso({ tipo: "ok", texto: msg });
      } else if (dialogo) {
        setErroDialogo(r.erro);
      } else {
        setAviso({ tipo: "erro", texto: r.erro });
      }
    });

  const aplicaAcesso = (
    papel: Papel,
    workspaceId: string | null,
    msg: string,
  ) => {
    const f = new FormData();
    f.set("userId", u.id);
    f.set("papel", papel);
    f.set("workspaceId", papel === "admin" ? "" : (workspaceId ?? ""));
    executa(() => defineAcesso(f), msg);
  };

  const mudaPapel = (valor: string) => {
    if (!ehPapel(valor) || valor === u.papel) return;
    if (valor === "admin") return abre({ tipo: "promove" });
    if (u.papel === "admin" || !u.workspaceId)
      return abre({
        tipo: "vincula",
        papel: valor,
        workspaceId: u.workspaceId ?? "",
      });
    aplicaAcesso(
      valor,
      u.workspaceId,
      `${u.nome} agora é ${valor === "gestor" ? "gestor" : "membro"}.`,
    );
  };

  const mudaWorkspace = (id: string) => {
    if (!id || id === u.workspaceId) return;
    // Primeiro vínculo não tira ninguém de equipe: aplica direto.
    if (!u.workspaceId) {
      const papel = u.papel === "gestor" ? "gestor" : "membro";
      aplicaAcesso(
        papel,
        id,
        `${u.nome} entrou em ${nomeWs(id)} como ${papel}.`,
      );
      return;
    }
    abre({ tipo: "troca-ws", workspaceId: id });
  };

  const travado = pendente || eu;

  return (
    <li
      aria-busy={pendente}
      className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_12rem_9rem_auto] sm:items-center sm:gap-3 sm:py-2.5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`truncate ${
              u.ativo
                ? "text-[var(--tinta-forte)]"
                : "text-[var(--tinta-fraca)] line-through"
            }`}
          >
            {u.nome}
          </span>
          {eu ? (
            <span className="text-xs text-[var(--tinta-fraca)]">você</span>
          ) : null}
          {!u.ativo ? <Etiqueta tom="vermelho">desativado</Etiqueta> : null}
          {u.papel === null ? (
            <Etiqueta tom="amarelo">sem acesso</Etiqueta>
          ) : null}
          {u.convitePendente ? (
            <Etiqueta tom="neutro">Convite pendente</Etiqueta>
          ) : null}
        </div>
        <div className="truncate text-xs text-[var(--tinta-fraca)]">
          {u.email}
        </div>
      </div>

      <Selecao
        value={u.papel === "admin" ? "" : (u.workspaceId ?? "")}
        disabled={travado || u.papel === "admin"}
        aria-label={`Workspace de ${u.nome}`}
        title={u.papel === "admin" ? "Admin vê todos os workspaces" : undefined}
        onChange={(ev) => mudaWorkspace(ev.target.value)}
      >
        <option value="" disabled>
          {u.papel === "admin" ? "Todos (admin)" : "Escolha o workspace…"}
        </option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.nome}
          </option>
        ))}
      </Selecao>

      <Selecao
        value={u.papel ?? ""}
        disabled={travado}
        aria-label={`Papel de ${u.nome}`}
        onChange={(ev) => mudaPapel(ev.target.value)}
      >
        {u.papel === null ? (
          <option value="" disabled>
            Sem papel
          </option>
        ) : null}
        {PAPEIS.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo}
          </option>
        ))}
      </Selecao>

      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
        {u.convitePendente ? (
          <Botao
            variante="fantasma"
            disabled={pendente}
            onClick={() => {
              const f = new FormData();
              f.set("userId", u.id);
              executa(
                () => reenviaConvite(f),
                `Convite reenviado para ${u.email}. A pessoa cria a senha pelo link do e-mail.`,
              );
            }}
          >
            Reenviar convite
          </Botao>
        ) : (
          <Botao
            variante="fantasma"
            disabled={pendente}
            onClick={() => abre({ tipo: "senha" })}
          >
            Redefinir senha
          </Botao>
        )}
        {eu ? null : (
          <Botao
            variante="fantasma"
            disabled={pendente}
            onClick={() => {
              if (u.ativo) return abre({ tipo: "desativa" });
              const f = new FormData();
              f.set("userId", u.id);
              f.set("ativo", "true");
              executa(() => alternaAtivo(f), `${u.nome} foi reativado.`);
            }}
          >
            {u.ativo ? "Desativar" : "Reativar"}
          </Botao>
        )}
      </div>

      {pendente || aviso ? (
        <p
          role={aviso?.tipo === "erro" ? "alert" : "status"}
          className={`text-xs sm:col-span-full ${
            aviso?.tipo === "erro" && !pendente
              ? "text-[var(--perigo-tinta)]"
              : pendente
                ? "text-[var(--tinta-fraca)]"
                : "text-[var(--sucesso-tinta)]"
          }`}
        >
          {pendente ? "Salvando…" : aviso?.texto}
        </p>
      ) : null}

      {dialogo?.tipo === "promove" ? (
        <Confirmacao
          aberto
          aoFechar={fecha}
          titulo={`Tornar ${u.nome} admin?`}
          descricao={`${u.nome} passará a ver todas as obras de todas as empresas e a administrar usuários e workspaces.${
            u.workspaceId
              ? ` Deixa de pertencer a ${nomeWs(u.workspaceId)} (admin não tem workspace).`
              : ""
          }`}
          rotuloConfirmar="Tornar admin"
          rotuloPendente="Salvando…"
          pendente={pendente}
          erro={erroDialogo}
          aoConfirmar={() =>
            aplicaAcesso("admin", null, `${u.nome} agora é admin.`)
          }
        />
      ) : null}

      {dialogo?.tipo === "desativa" ? (
        <Confirmacao
          aberto
          aoFechar={fecha}
          tom="perigo"
          titulo={`Desativar ${u.nome}?`}
          descricao={`${u.nome} perde o acesso ao 6wla na hora, inclusive em sessões já abertas. Restrições, comentários e histórico ficam. Dá para reativar depois; o acesso a outros sistemas da PHD não muda.`}
          rotuloConfirmar="Desativar"
          rotuloPendente="Desativando…"
          pendente={pendente}
          erro={erroDialogo}
          aoConfirmar={() => {
            const f = new FormData();
            f.set("userId", u.id);
            f.set("ativo", "false");
            executa(() => alternaAtivo(f), `${u.nome} foi desativado.`);
          }}
        />
      ) : null}

      {dialogo?.tipo === "troca-ws" ? (
        <Confirmacao
          aberto
          aoFechar={fecha}
          titulo={`Mover ${u.nome} para ${nomeWs(dialogo.workspaceId)}?`}
          descricao={`${u.nome} sai de ${nomeWs(u.workspaceId)} e das equipes das obras de lá, e passa a ver só as obras de ${nomeWs(dialogo.workspaceId)} em que for incluído.`}
          rotuloConfirmar="Mover"
          rotuloPendente="Movendo…"
          pendente={pendente}
          erro={erroDialogo}
          aoConfirmar={() =>
            aplicaAcesso(
              u.papel === "gestor" ? "gestor" : "membro",
              dialogo.workspaceId,
              `${u.nome} agora está em ${nomeWs(dialogo.workspaceId)}.`,
            )
          }
        />
      ) : null}

      {dialogo?.tipo === "vincula" ? (
        <Confirmacao
          aberto
          aoFechar={fecha}
          titulo={
            u.papel === "admin"
              ? `Tirar ${u.nome} de admin`
              : `Dar acesso a ${u.nome}`
          }
          descricao={
            u.papel === "admin"
              ? `${u.nome} deixa de ver todas as empresas. Escolha o papel e o workspace em que passa a trabalhar.`
              : "Escolha o papel e o workspace da pessoa."
          }
          rotuloConfirmar="Salvar acesso"
          rotuloPendente="Salvando…"
          pendente={pendente}
          erro={erroDialogo}
          confirmarDesabilitado={!dialogo.workspaceId}
          aoConfirmar={() =>
            aplicaAcesso(
              dialogo.papel,
              dialogo.workspaceId,
              `${u.nome} agora é ${dialogo.papel} em ${nomeWs(dialogo.workspaceId)}.`,
            )
          }
        >
          <CampoRotulado id={`vinc-papel-${u.id}`} rotulo="Papel">
            <Selecao
              id={`vinc-papel-${u.id}`}
              value={dialogo.papel}
              onChange={(ev) =>
                setDialogo({
                  ...dialogo,
                  papel: ev.target.value === "gestor" ? "gestor" : "membro",
                })
              }
            >
              <option value="gestor">
                Gestor · cria obras e monta equipes
              </option>
              <option value="membro">
                Membro · trabalha nas obras em que for incluído
              </option>
            </Selecao>
          </CampoRotulado>
          <CampoRotulado id={`vinc-ws-${u.id}`} rotulo="Workspace">
            <Selecao
              id={`vinc-ws-${u.id}`}
              value={dialogo.workspaceId}
              onChange={(ev) =>
                setDialogo({ ...dialogo, workspaceId: ev.target.value })
              }
            >
              <option value="" disabled>
                Escolha…
              </option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nome}
                </option>
              ))}
            </Selecao>
          </CampoRotulado>
        </Confirmacao>
      ) : null}

      {dialogo?.tipo === "senha" ? (
        <Confirmacao
          aberto
          aoFechar={fecha}
          titulo={`Enviar link para ${u.nome} redefinir a senha?`}
          descricao={`Enviamos para ${u.email} um link para a própria pessoa criar uma senha nova. A senha atual continua valendo até ela trocar. A senha é a mesma do PHD View: a troca vale nos dois sistemas.`}
          rotuloConfirmar="Enviar link"
          rotuloPendente="Enviando…"
          pendente={pendente}
          erro={erroDialogo}
          aoConfirmar={() => {
            const f = new FormData();
            f.set("userId", u.id);
            executa(
              () => enviaLinkSenha(f),
              `Link enviado para ${u.email}.`,
            );
          }}
        />
      ) : null}
    </li>
  );
}

function ModalUsuarioNovo({
  aberto,
  aoFechar,
  workspaces,
  workspaceInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  workspaces: Workspace[];
  workspaceInicial: string;
}) {
  const [papel, setPapel] = useState<Papel>("gestor");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    tipo: "nova" | "existente";
    email: string;
  } | null>(null);
  // Trocar a chave remonta o formulário limpo.
  const [versao, setVersao] = useState(0);
  const [pendente, inicia] = useTransition();

  const limpa = () => {
    setErro(null);
    setResultado(null);
    setPapel("gestor");
    setVersao((v) => v + 1);
  };
  const fecha = () => {
    if (pendente) return;
    limpa();
    aoFechar();
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={fecha}
      titulo="Cadastrar usuário"
      descricao="A pessoa recebe um convite por e-mail e cria a própria senha pelo link."
      largura={560}
      rodape={
        resultado ? (
          <>
            <Botao variante="secundario" onClick={limpa}>
              Cadastrar outra pessoa
            </Botao>
            <Botao onClick={fecha}>Concluir</Botao>
          </>
        ) : (
          <>
            <Botao variante="secundario" onClick={fecha} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-usuario-novo" disabled={pendente}>
              {pendente ? "Enviando convite…" : "Enviar convite"}
            </Botao>
          </>
        )
      }
    >
      {resultado?.tipo === "nova" ? (
        <Alerta tipo="ok">
          Convite enviado para {resultado.email}. A pessoa cria a senha pelo
          link do e-mail.
        </Alerta>
      ) : resultado?.tipo === "existente" ? (
        <Alerta tipo="ok">
          {resultado.email} já tinha conta em outro sistema da PHD e foi
          incluído no 6wla. A pessoa entra com a senha que já usa.
        </Alerta>
      ) : (
        <form
          key={versao}
          id="form-usuario-novo"
          className="space-y-4 pb-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            const dados = new FormData(ev.currentTarget);
            inicia(async () => {
              const r = await criaUsuario(dados);
              if (!r.ok) {
                setErro(r.erro);
                return;
              }
              setErro(null);
              const email = String(dados.get("email") ?? "").toLowerCase();
              setResultado({
                tipo: r.dados.contaExistente ? "existente" : "nova",
                email,
              });
            });
          }}
        >
          <CampoRotulado id="u-nome" rotulo="Nome">
            <Campo id="u-nome" name="nome" required data-autofocus maxLength={120} />
          </CampoRotulado>
          <CampoRotulado id="u-email" rotulo="E-mail">
            <Campo id="u-email" name="email" type="email" required />
          </CampoRotulado>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoRotulado id="u-papel" rotulo="Papel">
              <Selecao
                id="u-papel"
                name="papel"
                value={papel}
                onChange={(ev) => {
                  if (ehPapel(ev.target.value)) setPapel(ev.target.value);
                }}
              >
                {PAPEIS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </Selecao>
            </CampoRotulado>
            {papel === "admin" ? (
              <div className="self-end pb-2 text-xs text-[var(--tinta-fraca)]">
                Admin não pertence a workspace: vê todas as obras de todas as
                empresas.
              </div>
            ) : (
              <CampoRotulado id="u-ws" rotulo="Workspace">
                <Selecao
                  id="u-ws"
                  name="workspaceId"
                  required
                  defaultValue={workspaceInicial}
                >
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nome}
                    </option>
                  ))}
                </Selecao>
              </CampoRotulado>
            )}
          </div>
          <p className="text-xs text-[var(--tinta-fraca)]">
            {PAPEIS.find((p) => p.valor === papel)?.explica}.
          </p>
          {erro ? <Alerta>{erro}</Alerta> : null}
        </form>
      )}
    </Modal>
  );
}
