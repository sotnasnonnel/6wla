import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParetoCausas } from "./pareto";
import { SerieSemanal } from "./semanal";
import { BarrasEmpilhadas } from "./pecas";
import {
  porDimensao,
  porSemana,
  type LinhaIndicador,
} from "@/lib/restricoes/indicadores";

/**
 * Teste de fumaça dos gráficos. Existe porque um `const` local sombreando uma
 * constante do módulo derrubou a página inteira em produção sem o typecheck
 * reclamar: renderizar de verdade é o que pega esse tipo de erro.
 */

const HOJE = "2026-09-03";

const LINHAS: Array<LinhaIndicador & { causa_6m: string }> = [
  {
    status: "concluida",
    data_criacao: "2026-08-01",
    data_limite: "2026-08-20",
    data_conclusao: "2026-08-10",
    causa_6m: "MÉTODO",
  },
  {
    status: "concluida",
    data_criacao: "2026-08-01",
    data_limite: "2026-08-20",
    data_conclusao: "2026-08-25",
    causa_6m: "MÉTODO",
  },
  {
    status: "pendente",
    data_criacao: "2026-08-01",
    data_limite: "2026-08-02",
    data_conclusao: null,
    causa_6m: "MATERIAL",
  },
];

describe("ParetoCausas", () => {
  const grupos = porDimensao(LINHAS, "causa_6m", { hoje: HOJE });

  it("renderiza as causas, os totais e fecha o acumulado em 100%", () => {
    render(<ParetoCausas grupos={grupos} />);
    expect(screen.getByLabelText("Pareto das causas 6M")).toBeInTheDocument();
    expect(screen.getByText("MÉTODO")).toBeInTheDocument();
    expect(screen.getByText("MATERIAL")).toBeInTheDocument();
    // Aparece duas vezes: a marca do eixo à direita e o rótulo do último ponto.
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
    // 2 de 3 na primeira causa: 67% acumulado.
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("mostra a linha de corte de 80% e o resumo em texto", () => {
    render(<ParetoCausas grupos={grupos} />);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText(/respondem por/)).toBeInTheDocument();
  });

  it("sem dados, avisa em vez de quebrar", () => {
    render(<ParetoCausas grupos={[]} />);
    expect(screen.getByText(/Sem dados/)).toBeInTheDocument();
  });
});

describe("SerieSemanal", () => {
  it("renderiza as semanas com a legenda das duas séries", () => {
    render(<SerieSemanal pontos={porSemana(LINHAS)} />);
    expect(
      screen.getByLabelText("Concluídas e previstas por semana"),
    ).toBeInTheDocument();
    expect(screen.getByText("Concluídas")).toBeInTheDocument();
    expect(screen.getByText(/Previstas/)).toBeInTheDocument();
  });

  it("sem datas, avisa em vez de quebrar", () => {
    render(<SerieSemanal pontos={[]} />);
    expect(screen.getByText(/Sem datas/)).toBeInTheDocument();
  });
});

describe("BarrasEmpilhadas", () => {
  it("mostra rótulo e total de cada grupo", () => {
    render(
      <BarrasEmpilhadas
        grupos={porDimensao(LINHAS, "causa_6m", { hoje: HOJE })}
      />,
    );
    expect(screen.getByText("MÉTODO")).toBeInTheDocument();
    expect(screen.getByTitle("MÉTODO: 2")).toBeInTheDocument();
  });
});
