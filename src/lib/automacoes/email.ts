import { situacaoDe } from "@/lib/restricoes/indicadores";
import {
  COLUNAS,
  colunasValidas,
  dataEmail,
  type LinhaEmail,
  type RestricaoEmail,
} from "./colunas";
import {
  emailValido,
  SITUACOES_EMAIL,
  type AutomacaoConfig,
  type SituacaoEmail,
} from "./schema";

/**
 * Montagem dos e-mails das automações. Tudo puro: recebe as restrições e a
 * configuração, devolve destinatário, assunto e HTML. A mesma função serve a
 * prévia da tela e a API que o n8n chama — o que o gestor vê é o que sai.
 *
 * HTML para cliente de e-mail: tabelas, estilos inline, nada de CSS externo
 * nem script. TODO texto vindo do banco passa por `escapaHtml`.
 */

/** Restrição com o perfil do responsável (quando vinculado a um usuário). */
export type RestricaoComPerfil = RestricaoEmail & {
  responsavel: { nome: string; email: string } | null;
};

export type ObraEmail = { id: string; codigo: string; nome: string };

export type ConfigEmail = Pick<
  AutomacaoConfig,
  | "situacoes"
  | "colunas"
  | "destino"
  | "destinatarios"
  | "copias"
  | "assunto"
  | "agrupar_por_responsavel"
>;

export type ContextoEmail = {
  obra: ObraEmail;
  /** Origem pública do 6wla; `null` omite logo e link. */
  site: string | null;
  /** Hoje (aaaa-mm-dd) no fuso da automação. */
  hoje: string;
  config: ConfigEmail;
  /**
   * Sempre em cópia de todo e-mail da automação (decisão do usuário: o
   * gestor dono da obra acompanha tudo). Vazio no "enviar teste".
   */
  copiasFixas?: readonly string[];
};

export type Grupo = {
  chave: string;
  nome: string;
  email: string | null;
  itens: LinhaEmail[];
};

export type EmailMontado = {
  /** Um e-mail, ou vários separados por vírgula (destino "lista"). */
  destinatario: string;
  nome: string;
  copias: string[];
  assunto: string;
  html: string;
  total: number;
};

export const SITUACAO_EMAIL_INFO: Record<
  SituacaoEmail,
  {
    emoji: string;
    titulo: string;
    resumo: string;
    cor: string;
    explicacao: string;
  }
> = {
  atrasada: {
    emoji: "🔴",
    titulo: "Pendentes (prazo vencido)",
    resumo: "Pendentes",
    cor: "#c62828",
    explicacao: "Abertas com a data limite já vencida.",
  },
  no_prazo: {
    emoji: "🟢",
    titulo: "No prazo",
    resumo: "No prazo",
    cor: "#1b7f1b",
    explicacao: "Abertas com data limite hoje ou mais adiante.",
  },
  sem_prazo: {
    emoji: "⚪",
    titulo: "Sem prazo definido",
    resumo: "Sem prazo",
    cor: "#5f6b7a",
    explicacao: "Abertas sem data limite preenchida.",
  },
};

const NOME_SEM_RESPONSAVEL = "Sem responsável";

export function escapaHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Situação para o relatório; `null` para concluída/cancelada. */
export function situacaoEmail(
  r: Pick<
    RestricaoEmail,
    "status" | "data_limite" | "data_conclusao" | "data_criacao"
  >,
  hoje: string,
): SituacaoEmail | null {
  const s = situacaoDe(r, hoje);
  if (s === "atrasada") return "atrasada";
  if (s === "no_prazo") return r.data_limite ? "no_prazo" : "sem_prazo";
  return null;
}

function normaliza(v: string): string {
  return v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Destinatário: o e-mail do perfil vinculado; sem perfil, o
 * `responsavel_email` da restrição (a coluna de e-mail da planilha).
 * Decisão do usuário: vale o e-mail digitado, como na automação antiga, e o
 * gestor dono da obra vai sempre em cópia para acompanhar o que sai.
 */
function emailDaRestricao(r: RestricaoComPerfil): string | null {
  for (const bruto of [r.responsavel?.email, r.responsavel_email]) {
    const email = bruto?.trim().toLowerCase() ?? "";
    if (email && emailValido(email)) return email;
  }
  return null;
}

function copiasDoContexto(ctx: ContextoEmail): string[] {
  return [...ctx.config.copias, ...(ctx.copiasFixas ?? [])].map((c) =>
    c.trim().toLowerCase(),
  );
}

function comparaItens(a: LinhaEmail, b: LinhaEmail): number {
  const la = a.data_limite ?? "9999-99-99";
  const lb = b.data_limite ?? "9999-99-99";
  if (la !== lb) return la < lb ? -1 : 1;
  return a.numero - b.numero;
}

/**
 * Agrupa as restrições abertas nas situações escolhidas por responsável. A
 * chave é o e-mail do responsável, para a mesma pessoa não receber dois
 * e-mails; sem e-mail, agrupa pelo nome (e essa pessoa não recebe).
 */
export function agrupaPorResponsavel(
  restricoes: readonly RestricaoComPerfil[],
  situacoes: readonly SituacaoEmail[],
  hoje: string,
): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const r of restricoes) {
    const s = situacaoEmail(r, hoje);
    if (!s || !situacoes.includes(s)) continue;
    const nome =
      r.responsavel?.nome.trim() ||
      r.responsavel_nome?.trim() ||
      NOME_SEM_RESPONSAVEL;
    const email = emailDaRestricao(r);
    const chave = email ? `email:${email}` : `nome:${normaliza(nome)}`;
    const linha: LinhaEmail = { ...r, responsavelExibido: nome };
    const g = grupos.get(chave);
    if (g) {
      g.itens.push(linha);
      // Nome do perfil vale mais que o texto livre.
      if (r.responsavel) g.nome = r.responsavel.nome;
    } else {
      grupos.set(chave, { chave, nome, email, itens: [linha] });
    }
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, itens: [...g.itens].sort(comparaItens) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Troca os marcadores do assunto e tira quebras de linha. */
export function montaAssunto(
  modelo: string,
  dados: { responsavel: string; obra: ObraEmail; hoje: string },
): string {
  return modelo
    .replaceAll("{responsavel}", dados.responsavel)
    .replaceAll("{obra}", dados.obra.codigo || dados.obra.nome)
    .replaceAll("{data}", dataEmail(dados.hoje))
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 200);
}

type Bloco = { titulo: string | null; itens: LinhaEmail[] };

function porSituacao(itens: readonly LinhaEmail[], hoje: string) {
  const mapa: Record<SituacaoEmail, LinhaEmail[]> = {
    atrasada: [],
    no_prazo: [],
    sem_prazo: [],
  };
  for (const i of itens) {
    const s = situacaoEmail(i, hoje);
    if (s) mapa[s].push(i);
  }
  return mapa;
}

const FONTE = "font-family:Arial,Helvetica,sans-serif;";

function tabela(itens: readonly LinhaEmail[], ctx: ContextoEmail): string {
  const colunas = colunasValidas(ctx.config.colunas);
  const th = colunas
    .map(
      (c) =>
        `<th align="left" style="${FONTE}padding:8px 10px;background:#26405d;color:#ffffff;font-size:12px;font-weight:bold;border:1px solid #26405d;white-space:nowrap;">${escapaHtml(COLUNAS[c].rotulo)}</th>`,
    )
    .join("");
  const linhas = itens
    .map((item, i) => {
      const fundo = i % 2 === 0 ? "#ffffff" : "#f6f7f9";
      const tds = colunas
        .map(
          (c) =>
            `<td valign="top" style="${FONTE}padding:8px 10px;font-size:12px;color:#1f2937;border:1px solid #e3e6ea;background:${fundo};">${escapaHtml(COLUNAS[c].valor(item, ctx.hoje))}</td>`,
        )
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 20px;"><thead><tr>${th}</tr></thead><tbody>${linhas}</tbody></table>`;
}

function secoes(itens: readonly LinhaEmail[], ctx: ContextoEmail): string {
  const mapa = porSituacao(itens, ctx.hoje);
  return SITUACOES_EMAIL.filter((s) => ctx.config.situacoes.includes(s))
    .filter((s) => mapa[s].length > 0)
    .map((s) => {
      const info = SITUACAO_EMAIL_INFO[s];
      return `<h3 style="${FONTE}margin:18px 0 8px;font-size:15px;color:${info.cor};">${info.emoji} ${escapaHtml(info.titulo)} (${mapa[s].length})</h3>${tabela(mapa[s], ctx)}`;
    })
    .join("");
}

function resumo(itens: readonly LinhaEmail[], ctx: ContextoEmail): string {
  const mapa = porSituacao(itens, ctx.hoje);
  const celula = (rotulo: string, valor: number, cor: string) =>
    `<td align="center" style="${FONTE}padding:10px 16px;border:1px solid #e3e6ea;border-radius:6px;background:#ffffff;"><div style="font-size:22px;font-weight:bold;color:${cor};">${valor}</div><div style="font-size:12px;color:#5f6b7a;">${escapaHtml(rotulo)}</div></td><td style="width:8px;"></td>`;
  const celulas = SITUACOES_EMAIL.filter((s) =>
    ctx.config.situacoes.includes(s),
  )
    .map((s) =>
      celula(
        SITUACAO_EMAIL_INFO[s].resumo,
        mapa[s].length,
        SITUACAO_EMAIL_INFO[s].cor,
      ),
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr>${celulas}${celula("Total", itens.length, "#26405d")}</tr></table>`;
}

/** HTML completo de um e-mail. */
export function renderizaHtml({
  ctx,
  saudacao,
  blocos,
  titulo,
}: {
  ctx: ContextoEmail;
  saudacao: string | null;
  blocos: readonly Bloco[];
  titulo: string;
}): string {
  const todos = blocos.flatMap((b) => b.itens);
  const site = ctx.site ? ctx.site.replace(/\/+$/, "") : null;
  const obraRotulo = [ctx.obra.codigo, ctx.obra.nome]
    .filter(Boolean)
    .join(" – ");
  const logo = site
    ? `<img src="${escapaHtml(`${site}/logo-phd.png`)}" width="180" alt="PHD Engenharia" style="display:block;border:0;outline:none;width:180px;max-width:180px;height:auto;">`
    : `<span style="${FONTE}font-size:18px;font-weight:bold;color:#c35e1e;">PHD Engenharia</span>`;
  const link = site
    ? `<tr><td style="padding:4px 24px 20px;"><a href="${escapaHtml(`${site}/obras/${encodeURIComponent(ctx.obra.id)}/tabela`)}" style="${FONTE}display:inline-block;padding:10px 18px;background:#c35e1e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Abrir no 6wla</a></td></tr>`
    : "";
  const corpo = blocos
    .filter((b) => b.itens.length > 0)
    .map((b) =>
      b.titulo
        ? `<h2 style="${FONTE}margin:24px 0 4px;padding-top:12px;border-top:1px solid #e3e6ea;font-size:17px;color:#26405d;">${escapaHtml(b.titulo)}</h2>${secoes(b.itens, ctx)}`
        : secoes(b.itens, ctx),
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapaHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:1100px;background:#ffffff;border:1px solid #e3e6ea;border-radius:8px;">
<tr><td style="padding:18px 24px;border-bottom:3px solid #c35e1e;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left" valign="middle">${logo}</td>
<td align="right" valign="middle" style="${FONTE}font-size:12px;color:#5f6b7a;">${escapaHtml(dataEmail(ctx.hoje))}</td>
</tr></table>
</td></tr>
<tr><td style="padding:20px 24px 0;">
<h1 style="${FONTE}margin:0;font-size:20px;color:#26405d;">Relatório de restrições</h1>
<p style="${FONTE}margin:4px 0 0;font-size:14px;color:#4b5563;">Obra: ${escapaHtml(obraRotulo)}</p>
${saudacao ? `<p style="${FONTE}margin:12px 0 0;font-size:14px;color:#1f2937;">${escapaHtml(saudacao)}</p>` : ""}
</td></tr>
<tr><td style="padding:8px 24px 0;">${resumo(todos, ctx)}${corpo}</td></tr>
${link}
<tr><td align="center" style="${FONTE}padding:14px 24px;border-top:1px solid #e3e6ea;font-size:12px;color:#5f6b7a;">Este relatório foi enviado automaticamente · PHD Tech</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function copiasSem(
  copias: readonly string[],
  destinatarios: readonly string[],
): string[] {
  const fora = new Set(destinatarios);
  return [...new Set(copias.filter((c) => emailValido(c) && !fora.has(c)))];
}

function emailConsolidado(
  grupos: readonly Grupo[],
  ctx: ContextoEmail,
  destinatarios: readonly string[],
  copias: readonly string[],
  prefixoAssunto = "",
): EmailMontado | null {
  const total = grupos.reduce((n, g) => n + g.itens.length, 0);
  if (total === 0 || destinatarios.length === 0) return null;
  const blocos: Bloco[] = ctx.config.agrupar_por_responsavel
    ? grupos.map((g) => ({ titulo: g.nome, itens: g.itens }))
    : [
        {
          titulo: null,
          itens: grupos.flatMap((g) => g.itens).sort(comparaItens),
        },
      ];
  const assunto = montaAssunto(`${prefixoAssunto}${ctx.config.assunto}`, {
    responsavel: "Todos",
    obra: ctx.obra,
    hoje: ctx.hoje,
  });
  return {
    destinatario: [...destinatarios].join(", "),
    nome: "Todos os responsáveis",
    copias: copiasSem(copias, destinatarios),
    assunto,
    html: renderizaHtml({ ctx, saudacao: null, blocos, titulo: assunto }),
    total,
  };
}

function emailDoGrupo(
  g: Grupo & { email: string },
  ctx: ContextoEmail,
): EmailMontado {
  const assunto = montaAssunto(ctx.config.assunto, {
    responsavel: g.nome,
    obra: ctx.obra,
    hoje: ctx.hoje,
  });
  return {
    destinatario: g.email,
    nome: g.nome,
    copias: copiasSem(copiasDoContexto(ctx), [g.email]),
    assunto,
    html: renderizaHtml({
      ctx,
      saudacao: `Olá, ${g.nome}. Estas são as suas restrições em aberto:`,
      blocos: [{ titulo: null, itens: g.itens }],
      titulo: assunto,
    }),
    total: g.itens.length,
  };
}

export type ResultadoMontagem = {
  emails: EmailMontado[];
  /** Responsáveis com itens mas sem e-mail (destino "responsaveis"). */
  semEmail: Array<{ nome: string; total: number }>;
  totalItens: number;
};

/** Todos os e-mails de um disparo da automação. */
export function montaEmails(
  restricoes: readonly RestricaoComPerfil[],
  ctx: ContextoEmail,
): ResultadoMontagem {
  const grupos = agrupaPorResponsavel(
    restricoes,
    ctx.config.situacoes,
    ctx.hoje,
  );
  const totalItens = grupos.reduce((n, g) => n + g.itens.length, 0);

  if (ctx.config.destino === "lista") {
    const destinatarios = [
      ...new Set(ctx.config.destinatarios.filter(emailValido)),
    ];
    const unico = emailConsolidado(
      grupos,
      ctx,
      destinatarios,
      copiasDoContexto(ctx),
    );
    return { emails: unico ? [unico] : [], semEmail: [], totalItens };
  }

  const emails: EmailMontado[] = [];
  const semEmail: ResultadoMontagem["semEmail"] = [];
  for (const g of grupos) {
    if (g.email) emails.push(emailDoGrupo({ ...g, email: g.email }, ctx));
    else semEmail.push({ nome: g.nome, total: g.itens.length });
  }
  return { emails, semEmail, totalItens };
}

/**
 * "Enviar teste para mim": tudo num e-mail só, agrupado por responsável,
 * para quem pediu, sem cópias.
 */
export function montaEmailTeste(
  restricoes: readonly RestricaoComPerfil[],
  ctx: ContextoEmail,
  email: string,
): EmailMontado | null {
  const grupos = agrupaPorResponsavel(
    restricoes,
    ctx.config.situacoes,
    ctx.hoje,
  );
  return emailConsolidado(
    grupos,
    { ...ctx, config: { ...ctx.config, agrupar_por_responsavel: true } },
    [email],
    [],
    "[Teste] ",
  );
}
