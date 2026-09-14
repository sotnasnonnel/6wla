import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react";

/**
 * Primitivos da interface.
 *
 * Direção: ferramenta de operação de obra, não app de consumo. Densidade alta,
 * hierarquia por peso e tamanho (não por caixa alta), cantos discretos, borda
 * fina no lugar de sombra. Terracotta é reservado para ação e estado ativo —
 * se aparecer em tudo, deixa de indicar o que é clicável.
 */

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-[var(--marca-terracotta)] text-white hover:bg-[var(--marca-terracotta-escuro)] disabled:bg-[#d9c3b4]",
  secundario:
    "bg-white text-[var(--tinta-media)] border border-[var(--borda)] hover:border-[var(--marca-terracotta)] hover:text-[var(--marca-terracotta)]",
  perigo:
    "bg-white text-[var(--marca-terracotta-vermelho)] border border-[#e3c6bd] hover:bg-[var(--marca-terracotta-vermelho)] hover:text-white",
  fantasma: "text-[var(--tinta-media)] hover:bg-[var(--marca-gelo)]",
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
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 ${VARIANTES[variante]} ${className}`}
    />
  );
}

const CAMPO_BASE =
  "w-full rounded-md border border-[var(--borda)] bg-white px-2.5 py-2 text-base sm:py-1.5 sm:text-sm text-[var(--tinta-forte)] transition placeholder:text-[#a8a5a1] focus:border-[var(--marca-terracotta)] focus:outline-none disabled:bg-[var(--marca-gelo)] disabled:text-[var(--tinta-fraca)]";

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
      className="mb-1 block text-[13px] font-medium text-[var(--tinta-media)]"
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
          className="mt-1 text-xs text-[var(--marca-terracotta-vermelho)]"
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
  azul: "bg-[#e6ecf3] text-[var(--marca-azul)]",
  verde: "bg-[#d9f2f0] text-[#006b66]",
  amarelo: "bg-[#fbeeda] text-[#7d4610]",
  vermelho: "bg-[#f8e3dd] text-[#98402a]",
  roxo: "bg-[#e9e5f1] text-[#463877]",
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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONS[tom]}`}
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
      ? "border-[#e6c8bf] bg-[#fbf0ec] text-[#98402a]"
      : tipo === "ok"
        ? "border-[#a9dfda] bg-[#e8f7f5] text-[#006b66]"
        : "border-[#c8d3de] bg-[#eef3f8] text-[var(--marca-azul)]";
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${cor}`}
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
      className={`rounded-md border border-[var(--borda)] bg-white p-3 sm:p-4 ${className}`}
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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--tinta-forte)]">
          {titulo}
        </h1>
        {apoio ? (
          <p className="mt-0.5 text-sm text-[var(--tinta-fraca)]">{apoio}</p>
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
    <div className="rounded-md border border-dashed border-[#d5d2ce] bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--tinta-forte)]">{titulo}</p>
      {descricao ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--tinta-fraca)]">
          {descricao}
        </p>
      ) : null}
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  );
}
