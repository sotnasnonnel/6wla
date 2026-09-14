import { redirect } from "next/navigation";

/** Os indicadores agora são por obra; a lista de obras é a porta de entrada. */
export default function IndicadoresAntigo() {
  redirect("/obras");
}
