# Contrato do batimento

A API aceita `POST /filiais/{id}/batimentos` com `Authorization: Bearer <token>` e `Content-Type: application/json`. O identificador da filial vai na rota; o servidor registra o horário de recebimento.

```json
{
  "cpu": 12.5,
  "memoria": 45.2,
  "disco": 68.7,
  "servicos": { "spooler": true, "wuauserv": false },
  "latencia": 0
}
```

CPU, memória e disco livre são percentuais de 0 a 100. Serviços mapeiam nomes para booleanos. Latência é medida em milissegundos; o agente e o simulador usam zero quando não há medição. O retorno é 202 para envio aceito, 401 para token inválido e 422 para corpo inválido.
