import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react";

/**
 * Primitivos da interface, no padrão visual do app-phd (DESIGN_SYSTEM.md):
 * botões peso 600 com raio 8, cards brancos com raio 12 e sombra leve,
 * etiquetas em pílula, campos com anel de foco terracota.
 *
 * Terracota continua reservada para ação e estado ativo — se aparecer em
 * tudo, deixa de indicar o que é clicável.
 */

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-[var(--marca-terracotta)] text-white hover:bg-[var(--marca-terracotta-escuro)] hover:shadow-[0_4px_12px_rgba(196,74,40,0.28)] disabled:bg-[var(--marca-brand-200)] disabled:shadow-none",
  secundario:
    "bg-white text-[var(--marca-azul)] border border-[var(--borda)] hover:bg-[var(--plano)] hover:border-[var(--borda-forte)]",
  perigo: "bg-[var(--perigo-fundo)] text-[var(--perigo)] hover:bg-[#fecaca]",
  fantasma:
    "text-[var(--tinta-fraca)] hover:bg-[var(--marca-gelo)] hover:text-[var(--tinta-forte)]",
};

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9 ${VARIANTES[variante]} ${className}`}
    />
  );
}

const CAMPO_BASE =
  "w-full min-h-10 rounded-lg border-[1.5px] border-[var(--borda)] bg-white px-3 py-2 text-base sm:text-sm text-[var(--tinta-forte)] transition placeholder:text-[var(--tinta-apagada)] focus:border-[var(--marca-terracotta)] focus:shadow-[0_0_0_3px_var(--marca-anel)] focus:outline-none aria-[invalid=true]:border-[var(--perigo)] disabled:bg-[var(--plano)] disabled:text-[var(--tinta-fraca)]";

export function Campo({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${CAMPO_BASE} ${className}`} />;
}

export function AreaTexto({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${CAMPO_BASE} ${className}`} />;
}

export function Selecao({
  className = "",
  ...props
}: ComponentProps<"select">) {
  return <select {...props} className={`${CAMPO_BASE} ${className}`} />;
}

/**
 * Rótulo de campo. Sem caixa alta: em formulário denso, versalete atrapalha a
 * leitura e não acrescenta hierarquia que o peso já não dê.
 */
export function Rotulo({
  children,
  htmlFor,
  dica,
}: {
  children: ReactNode;
  htmlFor?: string;
  dica?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-medium text-[var(--tinta-media)]"
    >
      {children}
      {dica ? (
        <span className="ml-1.5 font-normal text-[var(--tinta-fraca)]">
          {dica}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Campo com rótulo e mensagem de erro, para não repetir a moldura em cada
 * form. O erro é ligado ao controle por `aria-describedby` e marca
 * `aria-invalid`: sem isso o leitor de tela anuncia um texto solto que não se
 * sabe de qual campo é.
 */
export function CampoRotulado({
  id,
  rotulo,
  dica,
  erro,
  className = "",
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  erro?: string;
  className?: string;
  children: ReactNode;
}) {
  const idErro = `${id}-erro`;
  const controle = isValidElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>(children)
    ? cloneElement(children, {
        "aria-describedby": erro ? idErro : undefined,
        "aria-invalid": erro ? true : undefined,
      })
    : children;

  return (
    <div className={className}>
      <Rotulo htmlFor={id} dica={dica}>
        {rotulo}
      </Rotulo>
      {controle}
      {erro ? (
        <p
          id={idErro}
          className="mt-1 text-xs text-[var(--perigo)]"
        >
          {erro}
        </p>
      ) : null}
    </div>
  );
}

type Tom = "neutro" | "azul" | "verde" | "amarelo" | "vermelho" | "roxo";

const TONS: Record<Tom, string> = {
  neutro: "bg-[var(--marca-gelo)] text-[var(--tinta-media)]",
  azul: "bg-[#dbeafe] text-[#1e40af]",
  verde: "bg-[var(--sucesso-fundo)] text-[var(--sucesso-tinta)]",
  amarelo: "bg-[var(--aviso-fundo)] text-[var(--aviso-tinta)]",
  vermelho: "bg-[var(--perigo-fundo)] text-[var(--perigo-tinta)]",
  roxo: "bg-[#ede9fe] text-[#5b21b6]",
};

export function Etiqueta({
  tom = "neutro",
  children,
}: {
  tom?: Tom;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

/**
 * Aviso de resultado. Erro interrompe (`alert`); confirmação e informação são
 * anunciadas sem cortar o que o leitor de tela está lendo (`status`).
 */
export function Alerta({
  tipo = "erro",
  children,
}: {
  tipo?: "erro" | "ok" | "info";
  children: ReactNode;
}) {
  const cor =
    tipo === "erro"
      ? "border-[#fecaca] bg-[var(--perigo-fundo)] text-[var(--perigo-tinta)]"
      : tipo === "ok"
        ? "border-[#a7f3d0] bg-[var(--sucesso-fundo)] text-[var(--sucesso-tinta)]"
        : "border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]";
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-2.5 text-sm ${cor}`}
    >
      {children}
    </div>
  );
}

export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--borda)] bg-white p-4 shadow-[var(--sombra-sm)] sm:px-[22px] sm:py-5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Cabeçalho de página: título e, opcionalmente, uma linha de apoio e as ações
 * da tela. As ações moram aqui para ficarem sempre no mesmo canto em todas as
 * abas.
 */
export function CabecalhoPagina({
  titulo,
  apoio,
  acoes,
}: {
  titulo: ReactNode;
  apoio?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-7">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)]">
          {titulo}
        </h1>
        {apoio ? (
          <p className="mt-1 text-sm text-[var(--tinta-fraca)]">{apoio}</p>
        ) : null}
      </div>
      {acoes ? (
        <div className="flex shrink-0 items-center gap-2">{acoes}</div>
      ) : null}
    </div>
  );
}

/** Compatibilidade com as telas que ainda usam o nome antigo. */
export function Titulo({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return <CabecalhoPagina titulo={children} apoio={sub} />;
}

/**
 * Estado vazio: diz o que aconteceu e oferece a ação que resolve. Tela vazia é
 * convite para agir, não aviso de que não há nada.
 */
export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--borda-forte)] bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-[var(--tinta-forte)]">{titulo}</p>
      {descricao ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--tinta-fraca)]">
          {descricao}
        </p>
      ) : null}
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  );
}
