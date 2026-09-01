// No-op de 'server-only' para os testes de integracao. Em producao o pacote
// real continua valendo: importar codigo de servidor de um Client Component
// vira erro de build, que e a protecao que queremos manter.
export {};
