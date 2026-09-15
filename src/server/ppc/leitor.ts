import "server-only";
import { leXlsx } from "@/lib/importacao/xlsx";
import { matrizPpc } from "@/lib/ppc/importacao";

export function leArquivoPpc(bytes: Uint8Array, aba: "PPC" | "Programação") {
  let lida;
  try {
    lida = leXlsx(bytes, aba, 10050, true);
  } catch (erro) {
    if (
      aba !== "Programação" ||
      !(erro instanceof Error) ||
      !erro.message.startsWith('Aba "Programação" não existe.')
    )
      throw erro;
    lida = leXlsx(bytes, "Programacao", 10050, true);
  }
  if (lida.matriz.length > 10050)
    throw new Error(
      "A aba contém linhas muito distantes. Exporte apenas a tabela de programação.",
    );
  const dados = matrizPpc(lida.matriz);
  if (dados.linhas.length > 5000)
    throw new Error("O limite é de 5.000 atividades por importação.");
  return { ...dados, aba: lida.aba };
}
