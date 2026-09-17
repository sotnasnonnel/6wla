"use client";

import {
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { adicionaNaEquipe, removeDaEquipe } from "@/server/obras/actions";
import { criaMembroNaObra } from "@/server/admin/usuarios";
import {
  Alerta,
  Botao,
  Campo,
  CampoRotulado,
  Etiqueta,
  Vazio,
} from "@/components/ui/basicos";
import { Combobox, type OpcaoCombobox } from "@/components/ui/combobox";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Modal } from "@/components/ui/modal";

type Papel = "admin" | "gestor" | "membro";

type Pessoa = { id: string; nome: string; email: string; papel: Papel };
type Integrante = Pessoa & {
  dono: boolean;
  /** Ainda não entrou pelo convite. Só vem calculado para o dono. */
  convitePendente?: boolean;
};
/** Linha na tela: o que veio do servidor mais o que está a caminho. */
type Linha = Integrante & { estado?: "incluindo" | "saindo" };

type Mudanca =
  { tipo: "inclui"; pessoa: Pessoa } | { tipo: "remove"; id: string };

type Aviso = { tipo: "ok" | "erro"; texto: string };

const PAPEL_ROTULO: Record<Papel, string> = {
  admin: "Admin",
  gestor: "Gestor",
  membro: "Membro",
};

/** Quanto tempo o aviso de sucesso fica junto da linha. Erro fica. */
const DURACAO_AVISO_MS = 4000;

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function aplica(linhas: Linha[], m: Mudanca): Linha[] {
  if (m.tipo === "inclui") {
    if (linhas.some((l) => l.id === m.pessoa.id)) return linhas;
    return [...linhas, { ...m.pessoa, dono: false, estado: "incluindo" }];
  }
  return linhas.map((l) => (l.id === m.id ? { ...l, estado: "saindo" } : l));
}

export function EquipeObra({
  obraId,
  equipe,
  candidatos,
  souDono,
  meuId,
}: {
  obraId: string;
  equipe: Integrante[];
  /** Pessoas do workspace fora da equipe (vazio para quem não é dono). */
  candidatos: Pessoa[];
  souDono: boolean;
  meuId: string;
}) {
  const [linhas, muda] = useOptimistic<Linha[], Mudanca>(equipe, aplica);
  const [escolhido, setEscolhido] = useState<OpcaoCombobox | null>(null);
  const [erroInclusao, setErroInclusao] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [tirar, setTirar] = useState<Integrante | null>(null);
  const [avisos, setAvisos] = useState<Record<string, Aviso>>({});
  /** Quem acabou de sair: a linha some, o aviso fica um instante no lugar. */
  const [saidas, setSaidas] = useState<Array<{ id: string; texto: string }>>(
    [],
  );
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  const agenda = (chave: string, fn: () => void) => {
    const antigo = timers.current.get(chave);
    if (antigo) window.clearTimeout(antigo);
    timers.current.set(
      chave,
      window.setTimeout(() => {
        timers.current.delete(chave);
        fn();
      }, DURACAO_AVISO_MS),
    );
  };

  const avisa = (id: string, aviso: Aviso | null) => {
    setAvisos((a) => {
      const novo = { ...a };
      if (aviso) novo[id] = aviso;
      else delete novo[id];
      return novo;
    });
    if (aviso?.tipo === "ok") agenda(`aviso-${id}`, () => avisa(id, null));
  };

  const naTela = new Set(linhas.map((l) => l.id));
  const opcoes: OpcaoCombobox[] = candidatos
    .filter((c) => !naTela.has(c.id))
    .map((c) => ({
      id: c.id,
      titulo: c.nome,
      detalhe: c.email,
      etiqueta: PAPEL_ROTULO[c.papel],
    }));
  const incluindoEscolhido =
    escolhido !== null &&
    linhas.some((l) => l.id === escolhido.id && l.estado === "incluindo");

  const inclui = () => {
    const pessoa = candidatos.find((c) => c.id === escolhido?.id);
    if (!pessoa) return;
    setErroInclusao(null);
    const f = new FormData();
    f.set("obraId", obraId);
    f.set("userId", pessoa.id);
    startTransition(async () => {
      muda({ tipo: "inclui", pessoa });
      const r = await adicionaNaEquipe(f);
      if (r.ok) {
        // Só limpa a escolha depois da confirmação: no erro, basta tentar de novo.
        setEscolhido((e) => (e?.id === pessoa.id ? null : e));
        avisa(pessoa.id, { tipo: "ok", texto: "Entrou na equipe." });
      } else {
        setErroInclusao(`${pessoa.nome}: ${r.erro}`);
      }
    });
  };

  const remove = (p: Integrante) => {
    setTirar(null);
    avisa(p.id, null);
    const f = new FormData();
    f.set("obraId", obraId);
    f.set("userId", p.id);
    startTransition(async () => {
      muda({ tipo: "remove", id: p.id });
      const r = await removeDaEquipe(f);
      if (r.ok) {
        const chave = `saida-${p.id}`;
        setSaidas((s) => [
          ...s.filter((x) => x.id !== p.id),
          { id: p.id, texto: `${p.nome} saiu da equipe.` },
        ]);
        agenda(chave, () => setSaidas((s) => s.filter((x) => x.id !== p.id)));
      } else {
        avisa(p.id, { tipo: "erro", texto: r.erro });
      }
    });
  };

  const saidasVisiveis = saidas.filter((s) => !naTela.has(s.id));

  return (
    <div className="space-y-4">
      {souDono ? (
        <div className="rounded-xl border border-[var(--borda)] bg-white p-4 shadow-[var(--sombra-sm)]">
          <label
            htmlFor="equipe-incluir"
            className="mb-1.5 block text-sm font-semibold text-[var(--tinta-forte)]"
          >
            Incluir pessoa do workspace
          </label>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(ev) => {
              ev.preventDefault();
              inclui();
            }}
          >
            <Combobox
              id="equipe-incluir"
              opcoes={opcoes}
              selecionado={escolhido}
              aoSelecionar={(o) => {
                setEscolhido(o);
                setErroInclusao(null);
              }}
              disabled={opcoes.length === 0}
              placeholder={
                opcoes.length === 0
                  ? "Todo o workspace já está na equipe"
                  : "Busque por nome ou e-mail"
              }
              vazio="Ninguém do workspace com esse nome ou e-mail"
            />
            <Botao
              type="submit"
              disabled={!escolhido || incluindoEscolhido}
              className="shrink-0"
            >
              {incluindoEscolhido ? "Incluindo…" : "Incluir"}
            </Botao>
          </form>
          {erroInclusao ? (
            <p role="alert" className="mt-2 text-sm text-[var(--perigo-tinta)]">
              {erroInclusao}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--tinta-fraca)]">
            A pessoa ainda não tem conta?{" "}
            <button
              type="button"
              onClick={() => setNova(true)}
              className="inline-flex min-h-10 items-center font-semibold text-[var(--marca-terracotta)] underline-offset-2 hover:underline sm:min-h-0"
            >
              Cadastrar nova pessoa
            </button>
          </p>
        </div>
      ) : null}

      {linhas.length === 0 && saidasVisiveis.length === 0 ? (
        <Vazio
          titulo="Ninguém na equipe ainda"
          descricao={
            souDono
              ? "Inclua as pessoas que vão acompanhar esta obra."
              : "O gestor da obra ainda não montou a equipe."
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--grade)] overflow-hidden rounded-xl border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)]">
          {linhas.map((p) => {
            const aviso = avisos[p.id];
            return (
              <li
                key={p.id}
                aria-busy={p.estado !== undefined}
                className={`px-4 py-3 transition-opacity ${
                  p.estado === "saindo" ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                      p.dono
                        ? "bg-[var(--marca-terracotta)]"
                        : "bg-[var(--marca-azul)]"
                    }`}
                  >
                    {iniciais(p.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--tinta-forte)]">
                      <span className="truncate">{p.nome}</span>
                      {p.id === meuId ? (
                        <span className="text-xs text-[var(--tinta-fraca)]">
                          você
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-[var(--tinta-fraca)]">
                      {p.email}
                    </div>
                  </div>
                  {p.convitePendente ? (
                    <Etiqueta tom="neutro">Convite pendente</Etiqueta>
                  ) : null}
                  {p.dono ? (
                    <Etiqueta tom="amarelo">Criou a obra</Etiqueta>
                  ) : (
                    <Etiqueta tom="neutro">{PAPEL_ROTULO[p.papel]}</Etiqueta>
                  )}
                  {souDono && !p.dono ? (
                    <Botao
                      variante="fantasma"
                      disabled={p.estado !== undefined}
                      onClick={() => setTirar(p)}
                      aria-label={`Tirar ${p.nome} da equipe`}
                    >
                      {p.estado === "saindo"
                        ? "Tirando…"
                        : p.estado === "incluindo"
                          ? "Incluindo…"
                          : "Tirar"}
                    </Botao>
                  ) : null}
                </div>
                {aviso ? (
                  <p
                    role={aviso.tipo === "erro" ? "alert" : "status"}
                    className={`mt-1 pl-11 text-xs ${
                      aviso.tipo === "erro"
                        ? "text-[var(--perigo-tinta)]"
                        : "text-[var(--sucesso-tinta)]"
                    }`}
                  >
                    {aviso.texto}
                  </p>
                ) : null}
              </li>
            );
          })}
          {saidasVisiveis.map((s) => (
            <li
              key={`saida-${s.id}`}
              role="status"
              className="px-4 py-2.5 text-xs text-[var(--sucesso-tinta)]"
            >
              {s.texto}
            </li>
          ))}
        </ul>
      )}

      {souDono ? (
        <>
          <Confirmacao
            aberto={tirar !== null}
            aoFechar={() => setTirar(null)}
            tom="perigo"
            titulo={
              tirar ? `Tirar ${tirar.nome} da equipe?` : "Tirar da equipe?"
            }
            descricao="A pessoa deixa de ver esta obra e suas restrições. O que ela já registrou continua aqui. Dá para incluí-la de novo depois."
            rotuloConfirmar="Tirar da equipe"
            aoConfirmar={() => {
              if (tirar) remove(tirar);
            }}
          />
          <ModalPessoaNova
            aberto={nova}
            aoFechar={() => setNova(false)}
            obraId={obraId}
            aoConcluir={(id, texto) => avisa(id, { tipo: "ok", texto })}
          />
        </>
      ) : null}
    </div>
  );
}

type ResultadoCadastro = { tipo: "nova" | "existente"; email: string };

function ModalPessoaNova({
  aberto,
  aoFechar,
  obraId,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  obraId: string;
  aoConcluir: (id: string, texto: string) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCadastro | null>(null);
  // Chave nova remonta o formulário limpo.
  const [versao, setVersao] = useState(0);
  const [pendente, inicia] = useTransition();

  const limpa = () => {
    setErro(null);
    setResultado(null);
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
      titulo="Cadastrar nova pessoa"
      descricao="Ela entra como membro do seu workspace, já fica na equipe desta obra e recebe um convite por e-mail para criar a própria senha."
      largura={520}
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
            <Botao type="submit" form="form-equipe-nova" disabled={pendente}>
              {pendente ? "Enviando convite…" : "Convidar e incluir"}
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
          {resultado.email} já tinha conta em outro sistema da PHD e entrou na
          equipe. A pessoa entra com a senha que já usa.
        </Alerta>
      ) : (
        <form
          key={versao}
          id="form-equipe-nova"
          className="space-y-4 pb-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            const dados = new FormData(ev.currentTarget);
            dados.set("obraId", obraId);
            inicia(async () => {
              const r = await criaMembroNaObra(dados);
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
              aoConcluir(
                r.dados.id,
                r.dados.contaExistente
                  ? "Incluída na equipe."
                  : "Convidada e incluída na equipe.",
              );
            });
          }}
        >
          <CampoRotulado id="n-nome" rotulo="Nome">
            <Campo id="n-nome" name="nome" required data-autofocus maxLength={120} />
          </CampoRotulado>
          <CampoRotulado id="n-email" rotulo="E-mail">
            <Campo id="n-email" name="email" type="email" required />
          </CampoRotulado>
          {erro ? <Alerta>{erro}</Alerta> : null}
        </form>
      )}
    </Modal>
  );
}
