"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviaAnexo, removeAnexo, urlAnexo } from "@/server/restricoes/anexos";
import type { Anexo } from "@/server/restricoes/queries";
import {
  ehImagem,
  formataTamanho,
  tipoDeArquivo,
  TAMANHO_MAXIMO_ANEXO,
} from "@/lib/restricoes/anexos";
import { Alerta, Botao } from "@/components/ui/basicos";
import { Confirmacao } from "@/components/ui/confirmacao";

type Props = {
  restricaoId: string;
  anexos: Anexo[];
  papel: "gestor" | "membro";
};

type Acao = "abrir" | "baixar" | "apagar";

const ROTULO_OCUPADO: Record<Acao, string> = {
  abrir: "Abrindo…",
  baixar: "Baixando…",
  apagar: "Apagando…",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Lista de anexos da restrição. Vários arquivos por restrição: uma foto da
 * frente de serviço, o projeto e o e-mail do fornecedor contam a mesma
 * história e ficam juntos.
 *
 * Só o gestor anexa e apaga; o membro vê, baixa e discute no chat. O botão
 * some para quem não pode — e a RLS recusa de qualquer jeito.
 */
export function AnexosRestricao({ restricaoId, anexos, papel }: Props) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, inicia] = useTransition();
  // Uma ação por anexo de cada vez; o rótulo do botão diz qual está andando.
  const [ocupadoCom, setOcupadoCom] = useState<{
    id: string;
    acao: Acao;
  } | null>(null);

  const enviar = (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    const escolhidos = [...arquivos];
    const grande = escolhidos.find((a) => a.size > TAMANHO_MAXIMO_ANEXO);
    if (grande) {
      setErro(
        `"${grande.name}" tem ${formataTamanho(grande.size)}; o limite por arquivo é 10 MB.`,
      );
      return;
    }
    setErro(null);
    inicia(async () => {
      // Um de cada vez: o erro aponta o arquivo que falhou, e o servidor não
      // leva dez uploads simultâneos por conta de um arrastar de pasta.
      for (const arquivo of escolhidos) {
        const form = new FormData();
        form.set("restricaoId", restricaoId);
        form.set("arquivo", arquivo);
        const res = await enviaAnexo(form);
        if (!res.ok) {
          setErro(`${arquivo.name}: ${res.erro}`);
          break;
        }
      }
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    });
  };

  /**
   * Abrir mostra o arquivo (imagem e PDF aparecem na aba nova); baixar salva
   * com o nome original. Nos dois casos o link é assinado na hora — o bucket
   * é privado e o endereço vence em um minuto.
   *
   * O Safari do iPhone bloqueia `window.open` que acontece depois de um
   * `await` (já não conta como gesto do usuário). Por isso a aba abre em
   * branco no clique e só recebe o endereço quando ele chega. Baixar não
   * precisa de aba: o link assinado responde como anexo e a página fica.
   */
  const abrir = async (anexo: Anexo, paraBaixar: boolean) => {
    if (ocupadoCom) return;
    const aba = paraBaixar ? null : window.open("", "_blank");
    if (aba) aba.opener = null;
    setErro(null);
    setOcupadoCom({ id: anexo.id, acao: paraBaixar ? "baixar" : "abrir" });
    try {
      const res = await urlAnexo(anexo.id, paraBaixar);
      if (!res.ok) {
        aba?.close();
        setErro(res.erro);
        return;
      }
      if (paraBaixar) window.location.assign(res.dados);
      else if (aba) aba.location.href = res.dados;
      // Bloqueador de pop-up recusou a aba: abre na própria página.
      else window.location.assign(res.dados);
    } catch {
      aba?.close();
      setErro("Não foi possível abrir o arquivo. Tente de novo.");
    } finally {
      setOcupadoCom(null);
    }
  };

  const [aApagar, setAApagar] = useState<Anexo | null>(null);
  const apagar = async (anexo: Anexo) => {
    if (ocupadoCom) return;
    setAApagar(null);
    setErro(null);
    setOcupadoCom({ id: anexo.id, acao: "apagar" });
    try {
      const res = await removeAnexo(anexo.id);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.refresh();
    } catch {
      setErro("Não foi possível apagar o anexo. Tente de novo.");
    } finally {
      setOcupadoCom(null);
    }
  };

  return (
    <div className="space-y-2">
      {erro ? <Alerta>{erro}</Alerta> : null}

      {anexos.length === 0 ? (
        <p className="py-2 text-sm text-[var(--tinta-fraca)]">
          {papel === "gestor"
            ? "Nenhum anexo. Junte foto, projeto ou e-mail que ajude a resolver a restrição."
            : "Nenhum anexo nesta restrição."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--grade)]">
          {anexos.map((a) => {
            const desta = ocupadoCom?.id === a.id ? ocupadoCom.acao : null;
            const travado = ocupadoCom !== null;
            return (
              <li key={a.id} className="flex items-center gap-1 py-2">
                <button
                  type="button"
                  onClick={() => void abrir(a, false)}
                  disabled={travado}
                  aria-busy={desta === "abrir" || undefined}
                  title={`Abrir "${a.nome}"`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded px-1 py-1 text-left transition hover:bg-[var(--marca-gelo)] disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[9px] font-semibold tracking-tight text-white"
                    // Imagem em verde, resto em cinza: dá para varrer a lista e
                    // achar a foto sem ler nome de arquivo.
                    style={{
                      background: ehImagem(a.tipo_mime) ? "#00a49a" : "#94a3b8",
                    }}
                  >
                    {tipoDeArquivo(a.nome, a.tipo_mime).slice(0, 4)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--tinta-forte)]">
                      {a.nome}
                    </span>
                    <span className="block text-[11px] text-[var(--tinta-fraca)]">
                      {desta
                        ? ROTULO_OCUPADO[desta]
                        : `${formataTamanho(a.tamanho)} · ${a.autor?.nome ?? "usuário removido"} · ${quando(a.criado_em)}`}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void abrir(a, true)}
                  disabled={travado}
                  aria-label={`Baixar ${a.nome}`}
                  title="Baixar o arquivo"
                  className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-medium text-[var(--marca-terracotta)] transition hover:bg-[var(--marca-gelo)] disabled:opacity-60"
                >
                  {desta === "baixar" ? "Baixando…" : "Baixar"}
                </button>
                {papel === "gestor" ? (
                  <button
                    type="button"
                    onClick={() => setAApagar(a)}
                    disabled={travado}
                    aria-label={`Apagar ${a.nome}`}
                    title="Apagar anexo"
                    className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs text-[var(--tinta-fraca)] transition hover:bg-[var(--perigo-fundo)] hover:text-[var(--marca-terracotta-vermelho)] disabled:opacity-60"
                  >
                    {desta === "apagar" ? "Apagando…" : "Apagar"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {papel === "gestor" ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            ref={entrada}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => enviar(e.target.files)}
          />
          <Botao
            variante="secundario"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
          >
            {enviando ? "Enviando…" : "Adicionar anexos"}
          </Botao>
          <span className="text-[11px] text-[var(--tinta-fraca)]">
            Vários arquivos de uma vez, até 10 MB cada.
          </span>
        </div>
      ) : null}
      <Confirmacao
        aberto={aApagar !== null}
        aoFechar={() => setAApagar(null)}
        titulo="Apagar anexo?"
        descricao={
          aApagar ? `"${aApagar.nome}" será apagado. Não dá para desfazer.` : undefined
        }
        rotuloConfirmar="Apagar"
        tom="perigo"
        aoConfirmar={() => {
          if (aApagar) void apagar(aApagar);
        }}
      />
    </div>
  );
}
